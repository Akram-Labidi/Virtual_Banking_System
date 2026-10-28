import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import Decimal from 'decimal.js';
import { JournalEntry } from '../../database/entities/JournalEntry.entity';
import { LedgerPosting } from '../../database/entities/LedgerPosting.entity';
import { Account } from '../../database/entities/Account.entity';
import {
  AccountStatus,
  AccountType,
  PostingDirection,
  TransactionStatus,
  UserRole,
} from '../../common/enums';
import { CreateJournalEntryDto } from './dto/journal-entry.dto';

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    @InjectRepository(JournalEntry)
    private readonly journalRepo: Repository<JournalEntry>,
    @InjectRepository(LedgerPosting)
    private readonly postingRepo: Repository<LedgerPosting>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Executes an atomic, double-entry financial transaction with:
   * 1. Idempotency guarantees (returns existing transaction if duplicate key)
   * 2. Canonical pessimistic lock ordering (prevents deadlocks under high concurrency)
   * 3. Row-level locks (SELECT FOR UPDATE / pessimistic_write)
   * 4. Double-entry balancing invariant (Sum of Debits == Sum of Credits)
   * 5. Solvency verification (Account balance cannot drop below 0)
   */
  async executeJournalEntry(
    dto: CreateJournalEntryDto,
    existingQueryRunner?: QueryRunner,
  ): Promise<JournalEntry> {
    // Validate the ledger invariants before checking or writing an idempotent result.
    if (dto.postings.length < 2) {
      throw new BadRequestException('A journal entry must contain at least two postings');
    }
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const posting of dto.postings) {
      const amount = new Decimal(posting.amount);
      if (amount.lessThanOrEqualTo(0)) {
        throw new BadRequestException(`Posting amount must be strictly positive: ${posting.amount}`);
      }
      if (amount.decimalPlaces() > 2) {
        throw new BadRequestException(`Posting amount must use at most two decimal places: ${posting.amount}`);
      }

      if (posting.direction === PostingDirection.DEBIT) {
        totalDebit = totalDebit.plus(amount);
      } else if (posting.direction === PostingDirection.CREDIT) {
        totalCredit = totalCredit.plus(amount);
      } else {
        throw new BadRequestException(`Invalid posting direction: ${posting.direction}`);
      }
    }

    if (!totalDebit.equals(totalCredit)) {
      throw new BadRequestException(
        `Double-entry invariant violated: Total Debits (${totalDebit.toFixed(2)}) != Total Credits (${totalCredit.toFixed(2)})`,
      );
    }

    const existing = await this.findIdempotentJournalEntry(dto);
    if (existing) {
      this.logger.log(`[IDEMPOTENCY] Replaying existing transaction ${existing.reference}`);
      return existing;
    }

    const queryRunner = existingQueryRunner || this.dataSource.createQueryRunner();
    const isLocalRunner = !existingQueryRunner;

    if (isLocalRunner) {
      await queryRunner.connect();
      if (this.dataSource.options.type === 'sqlite') {
        await queryRunner.query('PRAGMA busy_timeout = 30000');
      }
      await queryRunner.startTransaction('READ COMMITTED');
    }

    try {
      // 3. Canonical Lock Ordering: sort unique account IDs alphabetically
      // This mathematically guarantees no circular wait deadlock between concurrent transfers
      const uniqueAccountIds = Array.from(
        new Set(dto.postings.map((p) => p.accountId)),
      ).sort();

      const lockedAccountsMap = new Map<string, Account>();

      for (const accountId of uniqueAccountIds) {
        const accountQuery = queryRunner.manager
          .createQueryBuilder(Account, 'acc')
          .where('acc.id = :id', { id: accountId });
        if (this.dataSource.options.type === 'postgres') {
          accountQuery.setLock('pessimistic_write');
        } else if (this.dataSource.options.type === 'sqlite') {
          // SQLite has no row locks; a no-op write acquires its database write lock before reading.
          await queryRunner.manager.increment(Account, { id: accountId }, 'balance', 0);
        }
        const account = await accountQuery.getOne();

        if (!account) {
          throw new NotFoundException(`Account ${accountId} not found in ledger`);
        }

        if (account.status !== AccountStatus.ACTIVE) {
          throw new BadRequestException(`Account ${account.accountNumber} is ${account.status}`);
        }

        lockedAccountsMap.set(accountId, account);
      }

      // 4. Calculate net balance delta per account & verify solvency
      const deltas = new Map<string, Decimal>();
      for (const posting of dto.postings) {
        const current = deltas.get(posting.accountId) || new Decimal(0);
        const amount = new Decimal(posting.amount);
        const account = lockedAccountsMap.get(posting.accountId)!;
        const increasesBalance =
          (posting.direction === PostingDirection.DEBIT) ===
          this.hasDebitNormalBalance(account.accountType);
        const updated = increasesBalance
          ? current.plus(amount)
          : current.minus(amount);
        deltas.set(posting.accountId, updated);
      }

      // Check solvency for debited accounts
      for (const [accountId, delta] of deltas.entries()) {
        const account = lockedAccountsMap.get(accountId)!;
        const currentBal = new Decimal(account.balance);
        const projectedBal = currentBal.plus(delta);

        if (projectedBal.lessThan(0)) {
          throw new BadRequestException(
            `Insufficient funds for account ${account.accountNumber}: Balance is ${currentBal.toFixed(2)} EUR, required deduction is ${delta.abs().toFixed(2)} EUR`,
          );
        }
      }

      // 5. Create Journal Entry
      const reference =
        dto.reference ||
        `JE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase()}`;

      const journalEntry = queryRunner.manager.create(JournalEntry, {
        idempotencyKey: dto.idempotencyKey || null,
        reference,
        transactionType: dto.transactionType,
        status: TransactionStatus.COMPLETED,
        amount: totalDebit.toNumber(),
        currency: 'EUR',
        description: dto.description,
        metadataJson: dto.metadata ? JSON.stringify(dto.metadata) : null,
      });

      const savedJournalEntry = await queryRunner.manager.save(journalEntry);

      // 6. Apply postings and update balances
      const savedPostings: LedgerPosting[] = [];
      const balanceSnapshots = new Map<string, Decimal>();

      for (const posting of dto.postings) {
        const account = lockedAccountsMap.get(posting.accountId)!;
        const runningBal = balanceSnapshots.get(posting.accountId) || new Decimal(account.balance);
        const amount = new Decimal(posting.amount);
        const increasesBalance =
          (posting.direction === PostingDirection.DEBIT) ===
          this.hasDebitNormalBalance(account.accountType);
        const newBal = increasesBalance
          ? runningBal.plus(amount)
          : runningBal.minus(amount);

        balanceSnapshots.set(posting.accountId, newBal);

        const ledgerPosting = queryRunner.manager.create(LedgerPosting, {
          journalEntryId: savedJournalEntry.id,
          accountId: account.id,
          direction: posting.direction,
          amount: amount.toNumber(),
          currency: 'EUR',
          balanceAfter: newBal.toNumber(),
        });

        savedPostings.push(await queryRunner.manager.save(ledgerPosting));
      }

      // 7. Persist updated account balances
      for (const [accountId, finalBalance] of balanceSnapshots.entries()) {
        const account = lockedAccountsMap.get(accountId)!;
        account.balance = finalBalance.toNumber();
        await queryRunner.manager.save(account);
      }

      if (isLocalRunner) {
        await queryRunner.commitTransaction();
      }

      savedJournalEntry.postings = savedPostings;
      return savedJournalEntry;
    } catch (err) {
      if (isLocalRunner) {
        await queryRunner.rollbackTransaction();
      }
      if (dto.idempotencyKey && this.isUniqueConstraintError(err)) {
        const replay = await this.findIdempotentJournalEntry(dto);
        if (replay) {
          return replay;
        }
      }
      throw err;
    } finally {
      if (isLocalRunner) {
        await queryRunner.release();
      }
    }
  }

  async findIdempotentJournalEntry(
    dto: Pick<CreateJournalEntryDto, 'idempotencyKey' | 'transactionType' | 'postings'>,
  ): Promise<JournalEntry | undefined> {
    if (!dto.idempotencyKey) {
      return undefined;
    }
    const existing = await this.journalRepo.findOne({
      where: { idempotencyKey: dto.idempotencyKey },
      relations: ['postings', 'postings.account'],
    });
    if (!existing) {
      return undefined;
    }

    const requestedPostings = this.normalizePostings(dto.postings);
    const existingPostings = this.normalizePostings(existing.postings);
    const sameTransaction =
      existing.transactionType === dto.transactionType &&
      existingPostings.length === requestedPostings.length &&
      existingPostings.every((posting, index) => {
        const requested = requestedPostings[index];
        return (
          posting.accountId === requested.accountId &&
          posting.direction === requested.direction &&
          new Decimal(posting.amount).equals(requested.amount)
        );
      });
    if (!sameTransaction) {
      throw new ConflictException('Idempotency key already used for a different transaction');
    }
    return existing;
  }

  private normalizePostings(
    postings: Array<{ accountId: string; direction: PostingDirection; amount: number }>,
  ) {
    return postings
      .map((posting) => ({
        accountId: posting.accountId,
        direction: posting.direction,
        amount: new Decimal(posting.amount),
      }))
      .sort((left, right) =>
        `${left.accountId}:${left.direction}:${left.amount.toFixed(2)}`.localeCompare(
          `${right.accountId}:${right.direction}:${right.amount.toFixed(2)}`,
        ),
      );
  }

  private isUniqueConstraintError(error: unknown): boolean {
    const databaseError = error as { code?: string; driverError?: { code?: string } };
    const code = databaseError?.driverError?.code || databaseError?.code;
    return code === '23505' || code?.startsWith('SQLITE_CONSTRAINT') === true;
  }

  private hasDebitNormalBalance(accountType: Account['accountType']): boolean {
    return (
      accountType === AccountType.INTERNAL_CASH ||
      accountType === AccountType.INTERNAL_LOANS
    );
  }

  /**
   * Financial Audit & Reconciliation:
   * Recalculates account balance strictly by summing all historical LedgerPostings.
   * Compares calculated sum against account.balance and reports discrepancy if any.
   */
  async reconcileAccount(accountId: string): Promise<{
    accountId: string;
    accountNumber: string;
    cachedBalance: number;
    computedBalance: number;
    isBalanced: boolean;
    postingsCount: number;
  }> {
    const account = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const postings = await this.postingRepo.find({
      where: { accountId },
      order: { createdAt: 'ASC' },
    });

    let computed = new Decimal(0);
    for (const p of postings) {
      const amt = new Decimal(p.amount);
      const increasesBalance =
        (p.direction === PostingDirection.DEBIT) ===
        this.hasDebitNormalBalance(account.accountType);
      if (increasesBalance) {
        computed = computed.plus(amt);
      } else {
        computed = computed.minus(amt);
      }
    }

    const cached = new Decimal(account.balance);
    const isBalanced = computed.equals(cached);

    return {
      accountId: account.id,
      accountNumber: account.accountNumber,
      cachedBalance: cached.toNumber(),
      computedBalance: computed.toNumber(),
      isBalanced,
      postingsCount: postings.length,
    };
  }

  async getRecentJournalEntries(limit = 20): Promise<JournalEntry[]> {
    return this.journalRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['postings', 'postings.account'],
    });
  }

  async getAccountPostings(
    accountId: string,
    limit = 50,
    user?: { id: string; role: UserRole },
  ): Promise<LedgerPosting[]> {
    const account = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }
    if (user?.role === UserRole.CLIENT && account.userId !== user.id) {
      throw new ForbiddenException('Vous ne pouvez pas consulter ce compte');
    }
    return this.postingRepo.find({
      where: { accountId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['journalEntry', 'account'],
    });
  }
}
