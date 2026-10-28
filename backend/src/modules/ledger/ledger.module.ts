import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JournalEntry } from '../../database/entities/JournalEntry.entity';
import { LedgerPosting } from '../../database/entities/LedgerPosting.entity';
import { Account } from '../../database/entities/Account.entity';
import { LedgerService } from './ledger.service';
import { LedgerController } from './ledger.controller';

@Module({
  imports: [TypeOrmModule.forFeature([JournalEntry, LedgerPosting, Account])],
  controllers: [LedgerController],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
