import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VirtualCard } from '../../database/entities/VirtualCard.entity';
import { Account } from '../../database/entities/Account.entity';
import { CardsService } from './cards.service';
import { CardsController } from './cards.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([VirtualCard, Account]), LedgerModule, AuditModule],
  controllers: [CardsController],
  providers: [CardsService],
  exports: [CardsService],
})
export class CardsModule {}
