import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { Loan } from '../../database/entities/Loan.entity';
import { Account } from '../../database/entities/Account.entity';
import { LedgerService } from '../ledger/ledger.service';
import { AuditService } from '../audit/audit.service';
import {
  AccountType,
  LoanStatus,
  PostingDirection,
  TransactionType,
  UserRole,
} from '../../common/enums';
import { SimulateLoanDto, ApplyLoanDto } from './dto/loan.dto';

export interface AmortizationScheduleItem {
  month: number;
  monthlyPayment: number;
  principalPayment: number;
  interestPayment: number;
  remainingBalance: number;
}

export interface LoanSimulationResult {
  principalAmount: number;
  annualInterestRate: number;
  termMonths: number;
  monthlyPayment: number;
  totalInterest: number;
  totalCost: number;
  schedule: AmortizationScheduleItem[];
}

@Injectable()
export class LoansService {
  private readonly logger = new Logger(LoansService.name);

  constructor(
    @InjectRepository(Loan)
    private readonly loanRepo: Repository<Loan>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    private readonly dataSource: DataSource,
    private readonly ledgerService: LedgerService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Generates a standard French Constant Annuity Amortization Table
   */
  calculateSimulation(dto: SimulateLoanDto): LoanSimulationResult {
    const P = new Decimal(dto.principalAmount);
    const r = new Decimal(dto.annualInterestRate).dividedBy(100).dividedBy(12);
    const n = dto.termMonths;

    // Monthly payment formula: M = P * [r * (1 + r)^n] / [(1 + r)^n - 1]
    const onePlusR = r.plus(1);
    const compound = onePlusR.pow(n);
    const monthlyPayment = P.times(r.times(compound))
      .dividedBy(compound.minus(1))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const schedule: AmortizationScheduleItem[] = [];
    let remaining = P.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    let totalInterest = new Decimal(0);

    for (let month = 1; month <= n; month++) {
      const interestPart = remaining.times(r).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const payment = month === n ? remaining.plus(interestPart) : monthlyPayment;
      const principalPart = payment.minus(interestPart);
      remaining = Decimal.max(
        new Decimal(0),
        remaining.minus(principalPart).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      );
      totalInterest = totalInterest.plus(interestPart);

      schedule.push({
        month,
        monthlyPayment: Number(payment.toFixed(2)),
        principalPayment: Number(principalPart.toFixed(2)),
        interestPayment: Number(interestPart.toFixed(2)),
        remainingBalance: Number(remaining.toFixed(2)),
      });
    }

    return {
      principalAmount: Number(P.toFixed(2)),
      annualInterestRate: dto.annualInterestRate,
      termMonths: n,
      monthlyPayment: Number(monthlyPayment.toFixed(2)),
      totalInterest: Number(totalInterest.toFixed(2)),
      totalCost: Number(P.plus(totalInterest).toFixed(2)),
      schedule,
    };
  }

  async applyForLoan(
    userId: string,
    dto: ApplyLoanDto,
    ipAddress?: string,
  ): Promise<Loan> {
    const account = await this.accountRepo.findOne({
      where: { id: dto.accountId },
    });

    if (!account) {
      throw new NotFoundException(`Compte de versement introuvable`);
    }

    if (account.userId !== userId) {
      throw new ForbiddenException(`Le compte sélectionné ne vous appartient pas`);
    }

    const simulation = this.calculateSimulation(dto);

    const loan = this.loanRepo.create({
      userId,
      accountId: account.id,
      principalAmount: simulation.principalAmount,
      annualInterestRate: simulation.annualInterestRate,
      termMonths: simulation.termMonths,
      monthlyPayment: simulation.monthlyPayment,
      totalInterest: simulation.totalInterest,
      remainingBalance: simulation.principalAmount,
      scheduleJson: JSON.stringify(simulation.schedule),
      status: LoanStatus.PENDING,
    });

    const savedLoan = await this.loanRepo.save(loan);

    await this.auditService.log({
      userId,
      action: 'LOAN_APPLIED',
      resource: `Loan:${savedLoan.id}`,
      details: `Demande de prêt de ${simulation.principalAmount} EUR sur ${simulation.termMonths} mois`,
      ipAddress,
    });

    return savedLoan;
  }

  async getLoansByUser(userId: string): Promise<Loan[]> {
    return this.loanRepo.find({
      where: { userId },
      relations: ['account'],
      order: { createdAt: 'DESC' },
    });
  }

  async getAllLoans(limit = 50): Promise<Loan[]> {
    return this.loanRepo.find({
      relations: ['user', 'account'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Advisor/Admin approves a loan:
   * Sets status to ACTIVE and disburses the principal amount to the customer's account via the Double-Entry Ledger!
   */
  async approveLoan(
    loanId: string,
    staff: { id: string; role: UserRole },
  ): Promise<Loan> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    if (this.dataSource.options.type === 'sqlite') {
      await queryRunner.query('PRAGMA busy_timeout = 30000');
    }
    await queryRunner.startTransaction();
    let loan: Loan;
    try {
      const loanQuery = queryRunner.manager
        .createQueryBuilder(Loan, 'loan')
        .innerJoinAndSelect('loan.account', 'account')
        .where('loan.id = :id', { id: loanId });
      if (this.dataSource.options.type === 'postgres') {
        loanQuery.setLock('pessimistic_write');
      } else if (this.dataSource.options.type === 'sqlite') {
        const claim = await queryRunner.manager.update(
          Loan,
          { id: loanId, status: LoanStatus.PENDING },
          { status: LoanStatus.PENDING },
        );
        if (!claim.affected) {
          throw new BadRequestException('Le prêt a déjà été traité');
        }
      }
      loan = await loanQuery.getOne();
      if (!loan) {
        throw new NotFoundException('Dossier de prêt introuvable');
      }
      if (loan.status !== LoanStatus.PENDING) {
        throw new BadRequestException(`Le prêt est déjà au statut ${loan.status}`);
      }

      let bankLoansAccount = await queryRunner.manager.findOne(Account, {
        where: { accountType: AccountType.INTERNAL_LOANS },
      });
      if (!bankLoansAccount) {
        bankLoansAccount = await queryRunner.manager.save(
          queryRunner.manager.create(Account, {
            accountNumber: 'FR76 BANK 0000 0000 0000 LOAN 001',
            accountType: AccountType.INTERNAL_LOANS,
            balance: 0,
          }),
        );
      }

      await this.ledgerService.executeJournalEntry(
        {
          transactionType: TransactionType.LOAN_DISBURSEMENT,
          description: `Déblocage des fonds de prêt - Dossier #${loan.id.slice(0, 8)}`,
          metadata: { loanId: loan.id },
          postings: [
            {
              accountId: bankLoansAccount.id,
              direction: PostingDirection.DEBIT,
              amount: loan.principalAmount,
            },
            {
              accountId: loan.accountId,
              direction: PostingDirection.CREDIT,
              amount: loan.principalAmount,
            },
          ],
        },
        queryRunner,
      );

      loan.status = LoanStatus.ACTIVE;
      await queryRunner.manager.save(loan);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    await this.auditService.log({
      userId: staff.id,
      userRole: staff.role,
      action: 'LOAN_APPROVED_AND_DISBURSED',
      resource: `Loan:${loan.id}`,
      details: `Approbation et versement de ${loan.principalAmount} EUR sur compte ${loan.account.accountNumber}`,
    });

    return loan;
  }
}
