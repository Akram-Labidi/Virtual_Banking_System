import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User, Account, JournalEntry, LedgerPosting, FraudAlert, VirtualCard, Loan, AuditLog } from '../src/database/entities';
import { LedgerService } from '../src/modules/ledger/ledger.service';
import { AccountStatus, AccountType, PostingDirection, TransactionType } from '../src/common/enums';
import { randomUUID } from 'crypto';

async function runConcurrencyStressTest() {
  console.log('================================================================');
  console.log('  TEST DE STRESS CONCURRENCE : 100 RETRAITS SIMULTANÉS (RACE CONDITION)');
  console.log('================================================================');

  if ((process.env.DB_TYPE || 'postgres') !== 'postgres') {
    throw new Error('The concurrency stress test requires PostgreSQL row-level locks. Set DB_TYPE=postgres.');
  }

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'virtual_bank',
    entities: [User, Account, JournalEntry, LedgerPosting, FraudAlert, VirtualCard, Loan, AuditLog],
    synchronize: true,
  });

  await dataSource.initialize();
  console.log('✓ Connexion PostgreSQL de test initialisée.');

  const accountRepo = dataSource.getRepository(Account);
  const journalRepo = dataSource.getRepository(JournalEntry);
  const postingRepo = dataSource.getRepository(LedgerPosting);

  const ledgerService = new LedgerService(journalRepo, postingRepo, accountRepo, dataSource);

  // 1. Create a victim customer account with exactly 100.00 EUR
  const runId = randomUUID();
  const customerAccount = await accountRepo.save(
    accountRepo.create({
      accountNumber: `STRESS-${runId}-CUSTOMER`,
      accountType: AccountType.CHECKING,
      balance: 0,
      currency: 'EUR',
      status: AccountStatus.ACTIVE,
    }),
  );

  // 2. Create bank vault cash account
  const vaultAccount = await accountRepo.save(
    accountRepo.create({
      accountNumber: `STRESS-${runId}-VAULT`,
      accountType: AccountType.INTERNAL_CASH,
      balance: 0,
      currency: 'EUR',
      status: AccountStatus.ACTIVE,
    }),
  );

  await ledgerService.executeJournalEntry({
    idempotencyKey: `stress-opening-${runId}`,
    transactionType: TransactionType.DEPOSIT,
    description: `STRESS-${runId}-OPENING`,
    postings: [
      {
        accountId: vaultAccount.id,
        direction: PostingDirection.DEBIT,
        amount: 100.0,
      },
      {
        accountId: customerAccount.id,
        direction: PostingDirection.CREDIT,
        amount: 100.0,
      },
    ],
  });
  customerAccount.balance = 100;
  vaultAccount.balance = 100;

  console.log(`✓ Compte client créé avec solde initial : ${Number(customerAccount.balance).toFixed(2)} EUR`);
  console.log(`⚡ Lancement de 100 tentatives de retrait simultanées de 10.00 EUR chacune...`);
  console.log(`   (Montant théorique demandé : 1 000.00 EUR pour 100.00 EUR disponibles)\n`);

  let succeededCount = 0;
  let rejectedCount = 0;

  // Prepare 100 concurrent promises
  const promises = Array.from({ length: 100 }).map(async (_, idx) => {
    try {
      await ledgerService.executeJournalEntry({
        idempotencyKey: `stress-req-${idx}`,
        transactionType: TransactionType.WITHDRAWAL,
        description: `STRESS-${runId}-${idx + 1}`,
        postings: [
          {
            accountId: customerAccount.id,
            direction: PostingDirection.DEBIT,
            amount: 10.0,
          },
          {
            accountId: vaultAccount.id,
            direction: PostingDirection.CREDIT,
            amount: 10.0,
          },
        ],
      });
      succeededCount++;
    } catch (err) {
      rejectedCount++;
    }
  });

  // Execute all 100 concurrently in parallel
  const startTime = Date.now();
  await Promise.all(promises);
  const durationMs = Date.now() - startTime;

  // Verify final state
  const finalAccount = await accountRepo.findOne({ where: { id: customerAccount.id } });
  const reconciliation = await ledgerService.reconcileAccount(customerAccount.id);

  console.log('----------------------------------------------------------------');
  console.log(`⏱ Durée d'exécution      : ${durationMs} ms`);
  console.log(`✓ Opérations réussies    : ${succeededCount} (Attendu : 10)`);
  console.log(`✓ Opérations rejetées    : ${rejectedCount} (Attendu : 90 - Fonds insuffisants)`);
  console.log(`💰 Solde final du compte : ${Number(finalAccount?.balance).toFixed(2)} EUR (Attendu : 0.00 EUR)`);
  console.log(`🔍 Réconciliation Ledger : ${reconciliation.isBalanced ? 'CONFORME (100%)' : 'ÉCHEC'}`);
  console.log('----------------------------------------------------------------');

  const passed =
    succeededCount === 10 &&
    rejectedCount === 90 &&
    Number(finalAccount?.balance) === 0.0 &&
    reconciliation.isBalanced;

  await journalRepo
    .createQueryBuilder()
    .delete()
    .where('description LIKE :runId', { runId: `STRESS-${runId}-%` })
    .execute();
  await accountRepo.delete([customerAccount.id, vaultAccount.id]);
  await dataSource.destroy();

  if (passed) {
    console.log('🎉 RÉSULTAT : TEST DE CONCURRENCE RÉUSSI SANS AUCUNE ANOMALIE NI SOLDE NÉGATIF !');
    return;
  }
  throw new Error('Concurrent withdrawal test did not preserve the expected account balance.');
}

runConcurrencyStressTest().catch((err) => {
  console.error('Erreur durant le test de concurrence :', err);
  process.exit(1);
});
