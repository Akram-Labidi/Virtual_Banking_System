import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PostingDirection } from '../../common/enums';
import { JournalEntry } from './JournalEntry.entity';
import { Account } from './Account.entity';

@Entity('ledger_postings')
export class LedgerPosting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  journalEntryId: string;

  @ManyToOne(() => JournalEntry, (je) => je.postings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'journalEntryId' })
  journalEntry: JournalEntry;

  @Index()
  @Column()
  accountId: string;

  @ManyToOne(() => Account, (acc) => acc.postings, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'accountId' })
  account: Account;

  @Column({
    type: 'varchar',
  })
  direction: PostingDirection; // DEBIT or CREDIT

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  @Column({ default: 'EUR' })
  currency: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  balanceAfter: number;

  @CreateDateColumn()
  createdAt: Date;
}
