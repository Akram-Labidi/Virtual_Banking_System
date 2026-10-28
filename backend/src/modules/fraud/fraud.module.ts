import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FraudAlert } from '../../database/entities/FraudAlert.entity';
import { LedgerPosting } from '../../database/entities/LedgerPosting.entity';
import { FraudService } from './fraud.service';
import { FraudController } from './fraud.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FraudAlert, LedgerPosting])],
  controllers: [FraudController],
  providers: [FraudService],
  exports: [FraudService],
})
export class FraudModule {}
