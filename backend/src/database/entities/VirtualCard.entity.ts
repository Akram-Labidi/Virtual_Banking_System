import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CardStatus } from '../../common/enums';
import { Account } from './Account.entity';

@Entity('virtual_cards')
export class VirtualCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  accountId: string;

  @ManyToOne(() => Account, (acc) => acc.cards, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountId' })
  account: Account;

  @Column()
  cardNumber: string; // Stored securely / masked formatted

  @Column()
  cardHolder: string;

  @Column()
  expiry: string; // MM/YY

  @Column({ select: false })
  cvv: string;

  @Column({ default: 'EUR' })
  currency: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 1000.0 })
  dailyLimit: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 3000.0 })
  monthlyLimit: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0.0 })
  dailySpent: number;

  @Column({ type: 'date', nullable: true })
  dailySpentDate: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0.0 })
  monthlySpent: number;

  @Column({ nullable: true })
  monthlySpentPeriod: string;

  @Column({
    type: 'varchar',
    default: CardStatus.ACTIVE,
  })
  status: CardStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
