import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Decimal from 'decimal.js';
import { LedgerService } from './ledger.service';
import { JournalEntry } from '../../database/entities/JournalEntry.entity';
import { LedgerPosting } from '../../database/entities/LedgerPosting.entity';
import { Account } from '../../database/entities/Account.entity';
import { AccountType, PostingDirection, TransactionType } from '../../common/enums';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('LedgerService (Double-Entry Engine Unit Tests)', () => {
  let service: LedgerService;

  const mockJournalRepo = {
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((dto) => Promise.resolve({ id: 'je-1', ...dto })),
  };

  const mockPostingRepo = {
    find: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((dto) => Promise.resolve(dto)),
  };

  const mockAccountRepo = {
    findOne: jest.fn(),
    save: jest.fn((dto) => Promise.resolve(dto)),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        {
          provide: getRepositoryToken(JournalEntry),
          useValue: mockJournalRepo,
        },
        {
          provide: getRepositoryToken(LedgerPosting),
          useValue: mockPostingRepo,
        },
        {
          provide: getRepositoryToken(Account),
          useValue: mockAccountRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should REJECT an unbalanced journal entry where Debits != Credits', async () => {
    const unbalancedDto = {
      transactionType: TransactionType.TRANSFER,
      description: 'Tentative écriture déséquilibrée',
      postings: [
        {
          accountId: 'acc-1',
          direction: PostingDirection.DEBIT,
          amount: 100.0,
        },
        {
          accountId: 'acc-2',
          direction: PostingDirection.CREDIT,
          amount: 90.0, // Missing 10 EUR!
        },
      ],
    };

    await expect(service.executeJournalEntry(unbalancedDto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should REJECT negative or zero posting amounts', async () => {
    const invalidDto = {
      transactionType: TransactionType.TRANSFER,
      description: 'Montant négatif',
      postings: [
        {
          accountId: 'acc-1',
          direction: PostingDirection.DEBIT,
          amount: -50.0,
        },
        {
          accountId: 'acc-2',
          direction: PostingDirection.CREDIT,
          amount: -50.0,
        },
      ],
    };

    await expect(service.executeJournalEntry(invalidDto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should return existing entry immediately if Idempotency Key is matched', async () => {
    const existingEntry = {
      id: 'je-existing',
      idempotencyKey: 'key-abc-123',
      reference: 'TRF-EXISTING',
      transactionType: TransactionType.TRANSFER,
      postings: [
        { accountId: 'acc-1', direction: PostingDirection.DEBIT, amount: 50.0 },
        { accountId: 'acc-2', direction: PostingDirection.CREDIT, amount: 50.0 },
      ],
    };

    mockJournalRepo.findOne.mockResolvedValueOnce(existingEntry);

    const result = await service.executeJournalEntry({
      idempotencyKey: 'key-abc-123',
      transactionType: TransactionType.TRANSFER,
      description: 'Retry réseau',
      postings: [
        {
          accountId: 'acc-1',
          direction: PostingDirection.DEBIT,
          amount: 50.0,
        },
        {
          accountId: 'acc-2',
          direction: PostingDirection.CREDIT,
          amount: 50.0,
        },
      ],
    });

    expect(result).toBe(existingEntry);
    expect(mockJournalRepo.findOne).toHaveBeenCalledWith({
      where: { idempotencyKey: 'key-abc-123' },
      relations: ['postings', 'postings.account'],
    });
  });

  it('should reject reuse of an idempotency key for a different transaction', async () => {
    mockJournalRepo.findOne.mockResolvedValueOnce({
      idempotencyKey: 'key-abc-123',
      transactionType: TransactionType.TRANSFER,
      postings: [
        { accountId: 'acc-1', direction: PostingDirection.DEBIT, amount: 50.0 },
        { accountId: 'acc-2', direction: PostingDirection.CREDIT, amount: 50.0 },
      ],
    });

    await expect(
      service.executeJournalEntry({
        idempotencyKey: 'key-abc-123',
        transactionType: TransactionType.TRANSFER,
        description: 'Clé déjà utilisée',
        postings: [
          { accountId: 'acc-1', direction: PostingDirection.DEBIT, amount: 60.0 },
          { accountId: 'acc-2', direction: PostingDirection.CREDIT, amount: 60.0 },
        ],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should reconcile debit-normal bank assets using debit postings as increases', async () => {
    mockAccountRepo.findOne.mockResolvedValueOnce({
      id: 'cash-1',
      accountNumber: 'CASH-1',
      accountType: AccountType.INTERNAL_CASH,
      balance: 100,
    });
    mockPostingRepo.find.mockResolvedValueOnce([
      { direction: PostingDirection.DEBIT, amount: 100 },
    ]);

    await expect(service.reconcileAccount('cash-1')).resolves.toMatchObject({
      cachedBalance: 100,
      computedBalance: 100,
      isBalanced: true,
    });
  });

  it('should reject postings with fractional cents', async () => {
    await expect(
      service.executeJournalEntry({
        transactionType: TransactionType.TRANSFER,
        description: 'Montant inférieur au centime',
        postings: [
          { accountId: 'acc-1', direction: PostingDirection.DEBIT, amount: 1.001 },
          { accountId: 'acc-2', direction: PostingDirection.CREDIT, amount: 1.001 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
