import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import Decimal from 'decimal.js';
import { FraudAlert } from '../../database/entities/FraudAlert.entity';
import { LedgerPosting } from '../../database/entities/LedgerPosting.entity';
import { Account } from '../../database/entities/Account.entity';
import { FraudSeverity, PostingDirection } from '../../common/enums';

export interface FraudEvaluationResult {
  isBlocked: boolean;
  isFlagged: boolean;
  alerts: FraudAlert[];
}

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  constructor(
    @InjectRepository(FraudAlert)
    private readonly alertRepo: Repository<FraudAlert>,
    @InjectRepository(LedgerPosting)
    private readonly postingRepo: Repository<LedgerPosting>,
  ) {}

  /**
   * Evaluates transactional risk based on banking heuristics:
   * 1. High absolute amount (e.g., single transfer > 5,000 EUR)
   * 2. Velocity Spike (more than 3 outgoing transactions within 3 minutes)
   * 3. Volume Anomaly (transfer > 4x the historical 30-day average transaction size)
   */
  async evaluateTransaction(
    account: Account,
    amountNumber: number,
    userId: string,
  ): Promise<FraudEvaluationResult> {
    const alerts: FraudAlert[] = [];
    const amount = new Decimal(amountNumber);
    const now = new Date();

    // Rule 1: High Absolute Amount Threshold (> 5,000 EUR)
    if (amount.greaterThan(5000)) {
      const alert = this.alertRepo.create({
        accountId: account.id,
        userId,
        severity: amount.greaterThan(10000) ? FraudSeverity.CRITICAL : FraudSeverity.HIGH,
        ruleName: 'UNUSUAL_HIGH_AMOUNT',
        triggerAmount: amount.toNumber(),
        description: `Montant unitaire exceptionnel détecté : ${amount.toFixed(2)} EUR (seuil alerte fixé à 5000.00 EUR).`,
      });
      alerts.push(await this.alertRepo.save(alert));
      this.logger.warn(`[FRAUD] Alert UNUSUAL_HIGH_AMOUNT triggered for account ${account.accountNumber}: ${amount.toFixed(2)} EUR`);
    }

    // Rule 2: Velocity Check (Multiple outgoing transfers in a short window: 3 minutes)
    const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);
    const recentDebits = await this.postingRepo.find({
      where: {
        accountId: account.id,
        direction: PostingDirection.DEBIT,
        createdAt: MoreThan(threeMinutesAgo),
      },
    });

    if (recentDebits.length >= 3) {
      const alert = this.alertRepo.create({
        accountId: account.id,
        userId,
        severity: FraudSeverity.HIGH,
        ruleName: 'VELOCITY_LIMIT_EXCEEDED',
        triggerAmount: amount.toNumber(),
        description: `Vélocité suspecte : ${recentDebits.length + 1} virements initiés en moins de 3 minutes.`,
      });
      alerts.push(await this.alertRepo.save(alert));
      this.logger.warn(`[FRAUD] Alert VELOCITY_LIMIT_EXCEEDED triggered for account ${account.accountNumber}`);
    }

    // Rule 3: Deviation from Average (if history exists)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const historicalDebits = await this.postingRepo.find({
      where: {
        accountId: account.id,
        direction: PostingDirection.DEBIT,
        createdAt: MoreThan(thirtyDaysAgo),
      },
      take: 100,
    });

    if (historicalDebits.length >= 5) {
      const sum = historicalDebits.reduce((acc, p) => acc.plus(new Decimal(p.amount)), new Decimal(0));
      const avg = sum.dividedBy(historicalDebits.length);

      if (amount.greaterThan(avg.times(4)) && amount.greaterThan(1000)) {
        const alert = this.alertRepo.create({
          accountId: account.id,
          userId,
          severity: FraudSeverity.MEDIUM,
          ruleName: 'AMOUNT_OUTLIER_DEVIATION',
          triggerAmount: amount.toNumber(),
          description: `Montant supérieur à 4x la moyenne historique (${avg.toFixed(2)} EUR) de ce compte.`,
        });
        alerts.push(await this.alertRepo.save(alert));
      }
    }

    // Determine blocking action: Critical severity triggers auto-rejection
    const isBlocked = alerts.some((a) => a.severity === FraudSeverity.CRITICAL);
    const isFlagged = alerts.length > 0;

    return {
      isBlocked,
      isFlagged,
      alerts,
    };
  }

  async getAllAlerts(limit = 50, unresolvedOnly = false): Promise<FraudAlert[]> {
    const whereClause = unresolvedOnly ? { isResolved: false } : {};
    return this.alertRepo.find({
      where: whereClause,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async resolveAlert(
    alertId: string,
    resolvedBy: string,
    notes?: string,
  ): Promise<FraudAlert> {
    const alert = await this.alertRepo.findOne({ where: { id: alertId } });
    if (!alert) {
      throw new Error(`Fraud alert ${alertId} not found`);
    }
    alert.isResolved = true;
    alert.resolvedBy = resolvedBy;
    alert.resolutionNotes = notes || 'Résolu par le responsable conformité.';
    return this.alertRepo.save(alert);
  }
}
