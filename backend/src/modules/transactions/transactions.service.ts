import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../database/entities/Account.entity';
import { JournalEntry } from '../../database/entities/JournalEntry.entity';
import { LedgerService } from '../ledger/ledger.service';
import { FraudService } from '../fraud/fraud.service';
import { AuditService } from '../audit/audit.service';
import {
  AccountType,
  PostingDirection,
  TransactionType,
  UserRole,
} from '../../common/enums';
import { TransferDto, DepositDto, WithdrawalDto } from './dto/transaction.dto';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    private readonly ledgerService: LedgerService,
    private readonly fraudService: FraudService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Helper to fetch or initialize the bank's internal central cash reserve
   */
  async getOrCreateInternalAccount(type: AccountType): Promise<Account> {
    let account = await this.accountRepo.findOne({
      where: { accountType: type },
    });

    if (!account) {
      const numbers: Record<string, string> = {
        [AccountType.INTERNAL_CASH]: 'FR76 BANK 0000 0000 0000 CASH 001',
        [AccountType.INTERNAL_FEES]: 'FR76 BANK 0000 0000 0000 FEES 001',
        [AccountType.INTERNAL_LOANS]: 'FR76 BANK 0000 0000 0000 LOAN 001',
      };

      account = this.accountRepo.create({
        accountNumber: numbers[type] || `FR76 BANK INTERNAL ${Date.now()}`,
        accountType: type,
        balance: 0,
        currency: 'EUR',
        userId: null,
      });
      account = await this.accountRepo.save(account);
    }
    return account;
  }

  /**
   * Executes an inter-account transfer using the Double-Entry Ledger Engine
   */
  async executeTransfer(
    user: { id: string; role: UserRole },
    dto: TransferDto,
    idempotencyKey?: string,
    ipAddress?: string,
  ): Promise<JournalEntry> {
    const sourceAccount = await this.accountRepo.findOne({
      where: { id: dto.sourceAccountId },
      relations: ['user'],
    });

    if (!sourceAccount) {
      throw new NotFoundException(`Compte émetteur introuvable`);
    }

    // Role check: Only account owner or bank staff can transfer
    if (user.role === UserRole.CLIENT && sourceAccount.userId !== user.id) {
      throw new ForbiddenException(`Vous n'avez pas l'autorisation d'émettre un virement depuis ce compte`);
    }

    // Locate destination account either by UUID or IBAN
    let destAccount = await this.accountRepo.findOne({
      where: [
        { id: dto.destinationIdentifier },
        { accountNumber: dto.destinationIdentifier },
      ],
      relations: ['user'],
    });

    if (!destAccount) {
      throw new NotFoundException(`Compte destinataire '${dto.destinationIdentifier}' introuvable`);
    }

    if (sourceAccount.id === destAccount.id) {
      throw new BadRequestException(`Impossible d'effectuer un virement vers le même compte`);
    }

    const existing = await this.ledgerService.findIdempotentJournalEntry({
      idempotencyKey,
      transactionType: TransactionType.TRANSFER,
      postings: [
        { accountId: sourceAccount.id, direction: PostingDirection.DEBIT, amount: dto.amount },
        { accountId: destAccount.id, direction: PostingDirection.CREDIT, amount: dto.amount },
      ],
    });
    if (existing) {
      return existing;
    }

    // Anti-Fraud Pre-Flight Check
    const fraudEval = await this.fraudService.evaluateTransaction(
      sourceAccount,
      dto.amount,
      user.id,
    );

    if (fraudEval.isBlocked) {
      await this.auditService.log({
        userId: user.id,
        userRole: user.role,
        action: 'TRANSFER_BLOCKED_FRAUD',
        resource: `Account:${sourceAccount.accountNumber}`,
        details: `Virement de ${dto.amount} EUR bloqué par le moteur anti-fraude`,
        ipAddress,
      });
      throw new ForbiddenException(`Opération bloquée par les politiques de conformité anti-fraude`);
    }

    // Execute atomic journal entry in the Ledger Engine
    const description =
      dto.description ||
      `Virement de ${sourceAccount.accountNumber.slice(-4)} vers ${destAccount.accountNumber.slice(-4)}`;

    const journalEntry = await this.ledgerService.executeJournalEntry({
      idempotencyKey,
      transactionType: TransactionType.TRANSFER,
      description,
      metadata: {
        sourceAccountNumber: sourceAccount.accountNumber,
        destAccountNumber: destAccount.accountNumber,
        initiatorUserId: user.id,
        fraudFlagged: fraudEval.isFlagged,
      },
      postings: [
        {
          accountId: sourceAccount.id,
          direction: PostingDirection.DEBIT,
          amount: dto.amount,
        },
        {
          accountId: destAccount.id,
          direction: PostingDirection.CREDIT,
          amount: dto.amount,
        },
      ],
    });

    await this.auditService.log({
      userId: user.id,
      userRole: user.role,
      action: 'TRANSFER_COMPLETED',
      resource: `JournalEntry:${journalEntry.reference}`,
      details: `${dto.amount} EUR transférés de ${sourceAccount.accountNumber} à ${destAccount.accountNumber}`,
      ipAddress,
    });

    return journalEntry;
  }

  /**
   * Cash Deposit: Credits client account, debits internal bank cash reserve
   */
  async executeDeposit(
    user: { id: string; role: UserRole },
    dto: DepositDto,
    idempotencyKey?: string,
    ipAddress?: string,
  ): Promise<JournalEntry> {
    const account = await this.accountRepo.findOne({ where: { id: dto.accountId } });
    if (!account) {
      throw new NotFoundException(`Compte introuvable`);
    }
    if (user.role === UserRole.CLIENT && account.userId !== user.id) {
      throw new ForbiddenException(`Opération non autorisée sur ce compte`);
    }

    const cashVault = await this.getOrCreateInternalAccount(AccountType.INTERNAL_CASH);
    const existing = await this.ledgerService.findIdempotentJournalEntry({
      idempotencyKey,
      transactionType: TransactionType.DEPOSIT,
      postings: [
        { accountId: cashVault.id, direction: PostingDirection.DEBIT, amount: dto.amount },
        { accountId: account.id, direction: PostingDirection.CREDIT, amount: dto.amount },
      ],
    });
    if (existing) {
      return existing;
    }

    const journal = await this.ledgerService.executeJournalEntry({
      idempotencyKey,
      transactionType: TransactionType.DEPOSIT,
      description: dto.description || `Dépôt en espèces sur compte ${account.accountNumber.slice(-4)}`,
      metadata: { accountId: account.id, depositedBy: user.id },
      postings: [
        {
          accountId: cashVault.id,
          direction: PostingDirection.DEBIT,
          amount: dto.amount,
        },
        {
          accountId: account.id,
          direction: PostingDirection.CREDIT,
          amount: dto.amount,
        },
      ],
    });

    await this.auditService.log({
      userId: user.id,
      userRole: user.role,
      action: 'DEPOSIT_EXECUTED',
      resource: `Account:${account.accountNumber}`,
      details: `Dépôt de ${dto.amount} EUR`,
      ipAddress,
    });

    return journal;
  }

  /**
   * Cash Withdrawal: Debits client account, credits internal bank cash reserve
   */
  async executeWithdrawal(
    user: { id: string; role: UserRole },
    dto: WithdrawalDto,
    idempotencyKey?: string,
    ipAddress?: string,
  ): Promise<JournalEntry> {
    const account = await this.accountRepo.findOne({ where: { id: dto.accountId } });
    if (!account) {
      throw new NotFoundException(`Compte introuvable`);
    }

    if (user.role === UserRole.CLIENT && account.userId !== user.id) {
      throw new ForbiddenException(`Opération non autorisée sur ce compte`);
    }

    const cashVault = await this.getOrCreateInternalAccount(AccountType.INTERNAL_CASH);
    const existing = await this.ledgerService.findIdempotentJournalEntry({
      idempotencyKey,
      transactionType: TransactionType.WITHDRAWAL,
      postings: [
        { accountId: account.id, direction: PostingDirection.DEBIT, amount: dto.amount },
        { accountId: cashVault.id, direction: PostingDirection.CREDIT, amount: dto.amount },
      ],
    });
    if (existing) {
      return existing;
    }

    const journal = await this.ledgerService.executeJournalEntry({
      idempotencyKey,
      transactionType: TransactionType.WITHDRAWAL,
      description: dto.description || `Retrait d'espèces`,
      metadata: { accountId: account.id, withdrawnBy: user.id },
      postings: [
        {
          accountId: account.id,
          direction: PostingDirection.DEBIT,
          amount: dto.amount,
        },
        {
          accountId: cashVault.id,
          direction: PostingDirection.CREDIT,
          amount: dto.amount,
        },
      ],
    });

    await this.auditService.log({
      userId: user.id,
      userRole: user.role,
      action: 'WITHDRAWAL_EXECUTED',
      resource: `Account:${account.accountNumber}`,
      details: `Retrait de ${dto.amount} EUR`,
      ipAddress,
    });

    return journal;
  }
}
