import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../../database/entities/Account.entity';
import { JournalEntry } from '../../database/entities/JournalEntry.entity';
import { LedgerPosting } from '../../database/entities/LedgerPosting.entity';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { FraudModule } from '../fraud/fraud.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Account, JournalEntry, LedgerPosting]),
    LedgerModule,
    FraudModule,
    AuditModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
