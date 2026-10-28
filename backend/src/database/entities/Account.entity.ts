import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { AccountStatus, AccountType } from '../../common/enums';
import { User } from './User.entity';
import { LedgerPosting } from './LedgerPosting.entity';
import { VirtualCard } from './VirtualCard.entity';

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ unique: true })
  accountNumber: string; // IBAN format e.g., FR76...

  @Column({
    type: 'varchar',
    default: AccountType.CHECKING,
  })
  accountType: AccountType;

  @Column({ default: 'EUR' })
  currency: string;

  // Cached balance for immediate reads (strictly reconciled against LedgerPostings)
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0.0 })
  balance: number;

  @Column({
    type: 'varchar',
    default: AccountStatus.ACTIVE,
  })
  status: AccountStatus;

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User, (user) => user.accounts, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => LedgerPosting, (posting) => posting.account)
  postings: LedgerPosting[];

  @OneToMany(() => VirtualCard, (card) => card.account)
  cards: VirtualCard[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
