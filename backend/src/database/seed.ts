import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/User.entity';
import { Account } from './entities/Account.entity';
import { JournalEntry } from './entities/JournalEntry.entity';
import { LedgerPosting } from './entities/LedgerPosting.entity';
import { VirtualCard } from './entities/VirtualCard.entity';
import { Loan } from './entities/Loan.entity';
import { FraudAlert } from './entities/FraudAlert.entity';
import { AuditLog } from './entities/AuditLog.entity';
import {
  AccountStatus,
  AccountType,
  CardStatus,
  PostingDirection,
  TransactionStatus,
  TransactionType,
  UserRole,
} from '../common/enums';

export async function seedDatabase(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const accountRepo = dataSource.getRepository(Account);
  const journalRepo = dataSource.getRepository(JournalEntry);
  const postingRepo = dataSource.getRepository(LedgerPosting);
  const cardRepo = dataSource.getRepository(VirtualCard);
  const auditRepo = dataSource.getRepository(AuditLog);

  // Check if already seeded
  const userCount = await userRepo.count();
  if (userCount > 0) {
    console.log('[SEED] Base de données déjà initialisée.');
    return;
  }

  console.log('[SEED] Initialisation des données de démarrage AuraBank...');

  const passwordHash = await bcrypt.hash('BankSecret2026!', 10);

  // 1. Create Internal Bank Accounts
  const cashReserve = await accountRepo.save(
    accountRepo.create({
      accountNumber: 'FR76 3000 6000 0000 0000 0000 CASH',
      accountType: AccountType.INTERNAL_CASH,
      balance: 0,
      currency: 'EUR',
      status: AccountStatus.ACTIVE,
    }),
  );

  const equityReserve = await accountRepo.save(
    accountRepo.create({
      accountNumber: 'FR76 3000 6000 0000 0000 0000 EQUITY',
      accountType: AccountType.INTERNAL_EQUITY,
      balance: 0,
      currency: 'EUR',
      status: AccountStatus.ACTIVE,
    }),
  );

  const feeReserve = await accountRepo.save(
    accountRepo.create({
      accountNumber: 'FR76 3000 6000 0000 0000 0000 FEES',
      accountType: AccountType.INTERNAL_FEES,
      balance: 0,
      currency: 'EUR',
      status: AccountStatus.ACTIVE,
    }),
  );

  const loanReserve = await accountRepo.save(
    accountRepo.create({
      accountNumber: 'FR76 3000 6000 0000 0000 0000 LOAN',
      accountType: AccountType.INTERNAL_LOANS,
      balance: 0,
      currency: 'EUR',
      status: AccountStatus.ACTIVE,
    }),
  );

  // 2. Create Admin, Advisor, and Clients
  const admin = await userRepo.save(
    userRepo.create({
      email: 'admin@aurabank.fr',
      passwordHash,
      firstName: 'Directrice',
      lastName: 'Générale',
      role: UserRole.ADMIN,
    }),
  );

  const advisor = await userRepo.save(
    userRepo.create({
      email: 'conseiller@aurabank.fr',
      passwordHash,
      firstName: 'Marc',
      lastName: 'Vallet',
      role: UserRole.ADVISOR,
    }),
  );

  const alice = await userRepo.save(
    userRepo.create({
      email: 'alice@aurabank.fr',
      passwordHash,
      firstName: 'Alice',
      lastName: 'Martin',
      role: UserRole.CLIENT,
    }),
  );

  const bob = await userRepo.save(
    userRepo.create({
      email: 'bob@aurabank.fr',
      passwordHash,
      firstName: 'Bob',
      lastName: 'Durand',
      role: UserRole.CLIENT,
    }),
  );

  // 3. Create Accounts
  const aliceChecking = await accountRepo.save(
    accountRepo.create({
      accountNumber: 'FR76 3000 6000 0100 2000 3000 401',
      accountType: AccountType.CHECKING,
      balance: 4500.0,
      currency: 'EUR',
      status: AccountStatus.ACTIVE,
      userId: alice.id,
    }),
  );

  const aliceSavings = await accountRepo.save(
    accountRepo.create({
      accountNumber: 'FR76 3000 6000 0100 2000 3000 402',
      accountType: AccountType.SAVINGS,
      balance: 12000.0,
      currency: 'EUR',
      status: AccountStatus.ACTIVE,
      userId: alice.id,
    }),
  );

  const bobChecking = await accountRepo.save(
    accountRepo.create({
      accountNumber: 'FR76 3000 6000 0100 8000 9000 501',
      accountType: AccountType.CHECKING,
      balance: 2800.0,
      currency: 'EUR',
      status: AccountStatus.ACTIVE,
      userId: bob.id,
    }),
  );

  // 4. Create Virtual Card for Alice
  await cardRepo.save(
    cardRepo.create({
      accountId: aliceChecking.id,
      cardNumber: '4532 8912 3456 7810',
      cardHolder: 'ALICE MARTIN',
      expiry: '11/29',
      cvv: '842',
      dailyLimit: 1500.0,
      monthlyLimit: 4000.0,
      dailySpent: 120.0,
      dailySpentDate: new Date().toISOString().slice(0, 10),
      monthlySpent: 450.0,
      monthlySpentPeriod: new Date().toISOString().slice(0, 7),
      status: CardStatus.ACTIVE,
    }),
  );

  // 5. Record the opening bank capital before customer deposits.
  const capitalization = await journalRepo.save(
    journalRepo.create({
      reference: 'CAP-20261027-INIT01',
      transactionType: TransactionType.CAPITALIZATION,
      status: TransactionStatus.COMPLETED,
      amount: 10000000.0,
      description: 'Dotation initiale de la banque',
    }),
  );

  await postingRepo.save([
    postingRepo.create({
      journalEntryId: capitalization.id,
      accountId: cashReserve.id,
      direction: PostingDirection.DEBIT,
      amount: 10000000.0,
      balanceAfter: 10000000.0,
    }),
    postingRepo.create({
      journalEntryId: capitalization.id,
      accountId: equityReserve.id,
      direction: PostingDirection.CREDIT,
      amount: 10000000.0,
      balanceAfter: 10000000.0,
    }),
  ]);
  cashReserve.balance = 10000000.0;
  equityReserve.balance = 10000000.0;
  await accountRepo.save([cashReserve, equityReserve]);

  // 6. Create initial customer deposits in the double-entry journal.
  // Entry 1: Initial Deposit for Alice
  const journal1 = await journalRepo.save(
    journalRepo.create({
      reference: 'DEP-20261027-INIT01',
      transactionType: TransactionType.DEPOSIT,
      status: TransactionStatus.COMPLETED,
      amount: 4500.0,
      description: 'Dépôt initial d’ouverture',
    }),
  );

  await postingRepo.save([
    postingRepo.create({
      journalEntryId: journal1.id,
      accountId: cashReserve.id,
      direction: PostingDirection.DEBIT,
      amount: 4500.0,
      balanceAfter: 10004500.0,
    }),
    postingRepo.create({
      journalEntryId: journal1.id,
      accountId: aliceChecking.id,
      direction: PostingDirection.CREDIT,
      amount: 4500.0,
      balanceAfter: 4500.0,
    }),
  ]);

  // Entry 2: Initial Deposit for Bob
  const journal2 = await journalRepo.save(
    journalRepo.create({
      reference: 'DEP-20261027-INIT02',
      transactionType: TransactionType.DEPOSIT,
      status: TransactionStatus.COMPLETED,
      amount: 2800.0,
      description: 'Dépôt initial d’ouverture',
    }),
  );

  await postingRepo.save([
    postingRepo.create({
      journalEntryId: journal2.id,
      accountId: cashReserve.id,
      direction: PostingDirection.DEBIT,
      amount: 2800.0,
      balanceAfter: 10007300.0,
    }),
    postingRepo.create({
      journalEntryId: journal2.id,
      accountId: bobChecking.id,
      direction: PostingDirection.CREDIT,
      amount: 2800.0,
      balanceAfter: 2800.0,
    }),
  ]);

  const savingsDeposit = await journalRepo.save(
    journalRepo.create({
      reference: 'DEP-20261027-INIT03',
      transactionType: TransactionType.DEPOSIT,
      status: TransactionStatus.COMPLETED,
      amount: 12000.0,
      description: 'Dépôt initial du compte épargne Alice',
    }),
  );

  await postingRepo.save([
    postingRepo.create({
      journalEntryId: savingsDeposit.id,
      accountId: cashReserve.id,
      direction: PostingDirection.DEBIT,
      amount: 12000.0,
      balanceAfter: 10019300.0,
    }),
    postingRepo.create({
      journalEntryId: savingsDeposit.id,
      accountId: aliceSavings.id,
      direction: PostingDirection.CREDIT,
      amount: 12000.0,
      balanceAfter: 12000.0,
    }),
  ]);
  cashReserve.balance = 10019300.0;
  await accountRepo.save(cashReserve);

  console.log('[SEED] Base de données initialisée avec succès !');
  console.log('Comptes de test disponibles :');
  console.log('- Admin:      admin@aurabank.fr / BankSecret2026!');
  console.log('- Conseiller: conseiller@aurabank.fr / BankSecret2026!');
  console.log('- Client:     alice@aurabank.fr / BankSecret2026!');
  console.log('- Client:     bob@aurabank.fr / BankSecret2026!');
}
