import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../database/entities/Account.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { CardsService } from '../cards/cards.service';
import { AccountStatus, AccountType, UserRole } from '../../common/enums';

@Injectable()
export class SimulatorService implements OnModuleDestroy {
  private readonly logger = new Logger(SimulatorService.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private stats = {
    totalGenerated: 0,
    totalVolumeEur: 0,
    startedAt: null as Date | null,
    lastTickAt: null as Date | null,
    errors: 0,
  };

  private readonly merchants = [
    'Amazon.fr',
    'Carrefour Market',
    'Uber Eats',
    'Fnac Paris',
    'SNCF Connect',
    'Apple Store',
    'Netflix Mensuel',
    'TotalEnergies Station',
    'Boulangerie Paul',
    'Decathlon',
  ];

  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    private readonly transactionsService: TransactionsService,
    private readonly cardsService: CardsService,
  ) {}

  onModuleDestroy() {
    this.stop();
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      stats: this.stats,
    };
  }

  start(intervalMs = 3000) {
    if (this.isRunning) {
      return { message: 'Le simulateur est déjà en cours d’exécution', isRunning: true };
    }

    this.isRunning = true;
    this.stats.startedAt = new Date();
    this.logger.log(`[SIMULATOR] Traffic simulator started. Interval: ${intervalMs}ms`);

    this.timer = setInterval(async () => {
      try {
        await this.generateRandomEvent();
      } catch (err) {
        this.stats.errors++;
        this.logger.error(`[SIMULATOR] Event error: ${err.message}`);
      }
    }, intervalMs);

    return { message: 'Simulateur de trafic bancaire démarré avec succès', isRunning: true };
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    this.logger.log('[SIMULATOR] Traffic simulator stopped.');
    return { message: 'Simulateur arrêté', isRunning: false };
  }

  private async generateRandomEvent() {
    const accounts = await this.accountRepo.find({
      where: {
        status: AccountStatus.ACTIVE,
        accountType: AccountType.CHECKING,
      },
      relations: ['user', 'cards'],
    });

    if (accounts.length < 2) {
      this.logger.warn('[SIMULATOR] Insufficient active customer accounts to simulate traffic');
      return;
    }

    // Pick random source account
    const sourceIdx = Math.floor(Math.random() * accounts.length);
    const source = accounts[sourceIdx];

    // Pick random destination account (different from source)
    let destIdx = Math.floor(Math.random() * accounts.length);
    while (destIdx === sourceIdx) {
      destIdx = Math.floor(Math.random() * accounts.length);
    }
    const dest = accounts[destIdx];

    const dice = Math.random();

    if (dice < 0.5) {
      // 50% chance: Peer-to-peer transfer
      const amount = Math.floor(10 + Math.random() * 250);
      const isBurst = Math.random() < 0.1; // 10% chance of high amount to test fraud rule
      const finalAmount = isBurst ? 5500 : amount;

      await this.transactionsService.executeTransfer(
        { id: source.userId || 'system', role: UserRole.CLIENT },
        {
          sourceAccountId: source.id,
          destinationIdentifier: dest.id,
          amount: finalAmount,
          description: isBurst ? 'Achat matériel informatique pro' : 'Remboursement déjeuner',
        },
        `sim-trf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        '127.0.0.1 (Simulator)',
      );

      this.stats.totalGenerated++;
      this.stats.totalVolumeEur += finalAmount;
      this.stats.lastTickAt = new Date();
      this.logger.log(`[SIMULATOR] Transfer generated: ${finalAmount} EUR (${source.accountNumber.slice(-4)} -> ${dest.accountNumber.slice(-4)})`);

    } else if (dice < 0.8 && source.cards && source.cards.length > 0) {
      // 30% chance: Virtual Card Payment
      const card = source.cards[0];
      const merchant = this.merchants[Math.floor(Math.random() * this.merchants.length)];
      const amount = Math.floor(5 + Math.random() * 95);

      await this.cardsService.processCardPayment(card.id, {
        amount,
        merchant,
      }, {
        id: source.userId || 'system',
        role: UserRole.CLIENT,
      }, `sim-card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);

      this.stats.totalGenerated++;
      this.stats.totalVolumeEur += amount;
      this.stats.lastTickAt = new Date();
      this.logger.log(`[SIMULATOR] Card payment: ${amount} EUR at ${merchant}`);

    } else {
      // 20% chance: ATM cash deposit to replenish accounts
      const amount = Math.floor(100 + Math.random() * 400);

      await this.transactionsService.executeDeposit(
        { id: source.userId || 'system', role: UserRole.CLIENT },
        {
          accountId: source.id,
          amount,
          description: 'Versement distributeur automatique (GAB)',
        },
        `sim-dep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      );

      this.stats.totalGenerated++;
      this.stats.totalVolumeEur += amount;
      this.stats.lastTickAt = new Date();
      this.logger.log(`[SIMULATOR] ATM Deposit: +${amount} EUR on ${source.accountNumber.slice(-4)}`);
    }
  }
}
