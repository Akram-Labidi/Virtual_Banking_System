import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { TransactionStatus, TransactionType } from '../../common/enums';
import { LedgerPosting } from './LedgerPosting.entity';

@Entity('journal_entries')
export class JournalEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Key provided by client or caller to ensure idempotent executions (network retry / double-click protection)
  @Index({ unique: true })
  @Column({ unique: true, nullable: true })
  idempotencyKey: string;

  @Column({ unique: true })
  reference: string; // e.g. TRF-20261027-ABC12

  @Column({
    type: 'varchar',
    default: TransactionType.TRANSFER,
  })
  transactionType: TransactionType;

  @Column({
    type: 'varchar',
    default: TransactionStatus.COMPLETED,
  })
  status: TransactionStatus;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  @Column({ default: 'EUR' })
  currency: string;

  @Column()
  description: string;

  @Column({ type: 'text', nullable: true })
  metadataJson: string; // Store additional transaction metadata (e.g. initiator, IP, fraud scores)

  @OneToMany(() => LedgerPosting, (posting) => posting.journalEntry, {
    cascade: true,
  })
  postings: LedgerPosting[];

  @CreateDateColumn()
  createdAt: Date;
}
