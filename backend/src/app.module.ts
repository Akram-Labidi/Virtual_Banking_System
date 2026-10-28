import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  User,
  Account,
  JournalEntry,
  LedgerPosting,
  FraudAlert,
  VirtualCard,
  Loan,
  AuditLog,
} from './database/entities';
import { AuthModule } from './modules/auth/auth.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { FraudModule } from './modules/fraud/fraud.module';
import { CardsModule } from './modules/cards/cards.module';
import { LoansModule } from './modules/loans/loans.module';
import { AuditModule } from './modules/audit/audit.module';
import { SimulatorModule } from './modules/simulator/simulator.module';
import { seedDatabase } from './database/seed';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const databaseType = process.env.DB_TYPE || 'postgres';
        const isPostgres = databaseType === 'postgres';
        if (isPostgres) {
          return {
            type: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT) || 5432,
            username: process.env.DB_USERNAME || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            database: process.env.DB_DATABASE || 'virtual_bank',
            entities: [
              User,
              Account,
              JournalEntry,
              LedgerPosting,
              FraudAlert,
              VirtualCard,
              Loan,
              AuditLog,
            ],
            synchronize: process.env.NODE_ENV !== 'production',
            logging: process.env.NODE_ENV === 'development',
          };
        }

        if (databaseType !== 'sqlite') {
          throw new Error(`Unsupported DB_TYPE "${databaseType}". Use postgres or sqlite.`);
        }

        return {
          type: 'sqlite',
          database: process.env.DB_SQLITE_PATH || 'virtual_bank.sqlite',
          entities: [User, Account, JournalEntry, LedgerPosting, FraudAlert, VirtualCard, Loan, AuditLog],
          synchronize: true,
          logging: false,
        };
      },
    }),
    AuthModule,
    AccountsModule,
    LedgerModule,
    TransactionsModule,
    FraudModule,
    CardsModule,
    LoansModule,
    AuditModule,
    SimulatorModule,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    if (process.env.SEED_DEMO_DATA === 'true') {
      await seedDatabase(this.dataSource);
    }
  }
}
