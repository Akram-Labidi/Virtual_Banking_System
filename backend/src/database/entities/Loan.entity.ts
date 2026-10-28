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
import { LoanStatus } from '../../common/enums';
import { User } from './User.entity';
import { Account } from './Account.entity';

@Entity('loans')
export class Loan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @ManyToOne(() => User, (u) => u.loans, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column()
  accountId: string;

  @ManyToOne(() => Account, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'accountId' })
  account: Account;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  principalAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  annualInterestRate: number; // e.g. 4.5 for 4.5%

  @Column({ type: 'int' })
  termMonths: number;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  monthlyPayment: number;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  totalInterest: number;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  remainingBalance: number;

  @Column({ type: 'text', nullable: true })
  scheduleJson: string; // Amortization schedule breakdown

  @Column({
    type: 'varchar',
    default: LoanStatus.PENDING,
  })
  status: LoanStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
