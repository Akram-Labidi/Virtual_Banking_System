import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { AuditLog } from '../../database/entities/AuditLog.entity';

export interface AuditLogInput {
  userId?: string;
  userRole?: string;
  action: string;
  resource?: string;
  details?: string;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  /**
   * Appends an immutable audit entry protected by a cryptographic SHA-256 digest
   */
  async log(input: AuditLogInput): Promise<AuditLog> {
    const timestamp = new Date();
    const rawContent = `${timestamp.toISOString()}|${input.userId || 'ANONYMOUS'}|${input.action}|${input.resource || ''}|${input.details || ''}`;
    const payloadHash = crypto.createHash('sha256').update(rawContent).digest('hex');

    const entry = this.auditRepo.create({
      userId: input.userId || null,
      userRole: input.userRole || 'SYSTEM',
      action: input.action,
      resource: input.resource,
      ipAddress: input.ipAddress || '127.0.0.1',
      details: input.details,
      payloadHash,
      timestamp,
    });

    const saved = await this.auditRepo.save(entry);
    this.logger.debug(`[AUDIT] Action ${input.action} recorded. Hash: ${payloadHash.slice(0, 12)}...`);
    return saved;
  }

  async getLogs(limit = 100): Promise<AuditLog[]> {
    return this.auditRepo.find({
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Tamper-detection verification
   */
  async verifyIntegrity(logId: string): Promise<{
    id: string;
    action: string;
    isAuthentic: boolean;
    computedHash: string;
    storedHash: string;
  }> {
    const log = await this.auditRepo.findOne({ where: { id: logId } });
    if (!log) {
      throw new Error(`Audit log ${logId} not found`);
    }

    const rawContent = `${new Date(log.timestamp).toISOString()}|${log.userId || 'ANONYMOUS'}|${log.action}|${log.resource || ''}|${log.details || ''}`;
    const computedHash = crypto.createHash('sha256').update(rawContent).digest('hex');

    return {
      id: log.id,
      action: log.action,
      isAuthentic: computedHash === log.payloadHash,
      computedHash,
      storedHash: log.payloadHash,
    };
  }
}
