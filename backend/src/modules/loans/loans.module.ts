import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Loan } from '../../database/entities/Loan.entity';
import { Account } from '../../database/entities/Account.entity';
import { LoansService } from './loans.service';
import { LoansController } from './loans.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Loan, Account]), LedgerModule, AuditModule],
  controllers: [LoansController],
  providers: [LoansService],
  exports: [LoansService],
})
export class LoansModule {}
