import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { FraudSeverity } from '../../common/enums';

@Entity('fraud_alerts')
export class FraudAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ nullable: true })
  journalEntryId: string;

  @Index()
  @Column()
  accountId: string;

  @Index()
  @Column()
  userId: string;

  @Column({
    type: 'varchar',
    default: FraudSeverity.MEDIUM,
  })
  severity: FraudSeverity;

  @Column()
  ruleName: string; // e.g., 'VELOCITY_LIMIT_EXCEEDED', 'UNUSUAL_HIGH_AMOUNT'

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  triggerAmount: number;

  @Column({ default: false })
  isResolved: boolean;

  @Column({ nullable: true })
  resolvedBy: string;

  @Column({ nullable: true })
  resolutionNotes: string;

  @CreateDateColumn()
  createdAt: Date;
}
