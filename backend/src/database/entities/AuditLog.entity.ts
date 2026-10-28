import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ nullable: true })
  userId: string;

  @Column({ default: 'SYSTEM' })
  userRole: string;

  @Index()
  @Column()
  action: string; // e.g. 'AUTH_LOGIN', 'TRANSFER_INITIATED', 'ACCOUNT_FROZEN'

  @Column({ nullable: true })
  resource: string; // e.g. 'Account:FR76...', 'Card:123'

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  details: string;

  // Cryptographic hash for immutability verification (SHA256 of timestamp + action + resource + details)
  @Column({ nullable: true })
  payloadHash: string;

  @CreateDateColumn()
  timestamp: Date;
}
