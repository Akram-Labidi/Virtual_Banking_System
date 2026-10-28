import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Account } from '../../database/entities/Account.entity';
import { LedgerService } from '../ledger/ledger.service';
import { AuditService } from '../audit/audit.service';
import {
  AccountStatus,
  AccountType,
  PostingDirection,
  TransactionType,
  UserRole,
} from '../../common/enums';
import { CreateAccountDto } from './dto/create-account.dto';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    private readonly dataSource: DataSource,
    private readonly ledgerService: LedgerService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Generates a compliant mock French IBAN: FR76 3000 6000 01XX XXXX XXXX XX
   */
  private generateIban(): string {
    const bankCode = '30006'; // Code banque
    const branchCode = '00001'; // Code guichet
    const accountNum = Math.floor(10000000000 + Math.random() * 90000000000).toString();
    const ribKey = Math.floor(10 + Math.random() * 89).toString();
    return `FR76 ${bankCode} ${branchCode} ${accountNum.slice(0, 4)} ${accountNum.slice(4, 8)} ${accountNum.slice(8, 11)}${ribKey}`;
  }

  async createAccount(
    userId: string,
    dto: CreateAccountDto,
    ipAddress?: string,
  ): Promise<Account> {
    if (![AccountType.CHECKING, AccountType.SAVINGS].includes(dto.accountType)) {
      throw new BadRequestException('Seuls les comptes courant et épargne peuvent être ouverts');
    }

    const iban = this.generateIban();

    const account = this.accountRepo.create({
      accountNumber: iban,
      accountType: dto.accountType,
      balance: 0.0,
      currency: 'EUR',
      status: AccountStatus.ACTIVE,
      userId,
    });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let savedAccount: Account;
    try {
      savedAccount = await queryRunner.manager.save(
        queryRunner.manager.create(Account, account),
      );

      if (dto.initialDeposit && dto.initialDeposit > 0) {
        let cashReserve = await queryRunner.manager.findOne(Account, {
          where: { accountType: AccountType.INTERNAL_CASH },
        });
        if (!cashReserve) {
          cashReserve = await queryRunner.manager.save(
            queryRunner.manager.create(Account, {
              accountNumber: 'FR76 BANK 0000 0000 0000 CASH 001',
              accountType: AccountType.INTERNAL_CASH,
              balance: 0,
              currency: 'EUR',
            }),
          );
        }

        await this.ledgerService.executeJournalEntry(
          {
            transactionType: TransactionType.DEPOSIT,
            description: 'Dépôt initial d’ouverture de compte',
            postings: [
              {
                accountId: cashReserve.id,
                direction: PostingDirection.DEBIT,
                amount: dto.initialDeposit,
              },
              {
                accountId: savedAccount.id,
                direction: PostingDirection.CREDIT,
                amount: dto.initialDeposit,
              },
            ],
          },
          queryRunner,
        );
        savedAccount.balance = dto.initialDeposit;
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    await this.auditService.log({
      userId,
      action: 'ACCOUNT_CREATED',
      resource: `Account:${savedAccount.accountNumber}`,
      details: `Création compte ${savedAccount.accountType} (Solde initial: ${dto.initialDeposit || 0} EUR)`,
      ipAddress,
    });

    return savedAccount;
  }

  async getAccountsByUser(userId: string): Promise<Account[]> {
    return this.accountRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getAllAccounts(limit = 100): Promise<Account[]> {
    return this.accountRepo.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getAccountById(id: string): Promise<Account> {
    const account = await this.accountRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!account) {
      throw new NotFoundException(`Compte introuvable`);
    }
    return account;
  }

  async updateAccountStatus(
    id: string,
    status: AccountStatus,
    adminUser: { id: string; role: UserRole },
  ): Promise<Account> {
    const account = await this.getAccountById(id);
    account.status = status;
    const updated = await this.accountRepo.save(account);

    await this.auditService.log({
      userId: adminUser.id,
      userRole: adminUser.role,
      action: 'ACCOUNT_STATUS_CHANGE',
      resource: `Account:${account.accountNumber}`,
      details: `Statut modifié vers ${status}`,
    });

    return updated;
  }
}
