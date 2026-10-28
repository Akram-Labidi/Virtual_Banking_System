import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { VirtualCard } from '../../database/entities/VirtualCard.entity';
import { Account } from '../../database/entities/Account.entity';
import { LedgerService } from '../ledger/ledger.service';
import { AuditService } from '../audit/audit.service';
import {
  AccountType,
  CardStatus,
  PostingDirection,
  TransactionType,
  UserRole,
} from '../../common/enums';
import { CreateCardDto, CardPaymentDto } from './dto/card.dto';

@Injectable()
export class CardsService {
  private readonly logger = new Logger(CardsService.name);

  constructor(
    @InjectRepository(VirtualCard)
    private readonly cardRepo: Repository<VirtualCard>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    private readonly dataSource: DataSource,
    private readonly ledgerService: LedgerService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Generates a 16-digit card number (Visa standard starting with 4532)
   */
  private generateCardNumber(): string {
    let num = '4532';
    for (let i = 0; i < 12; i++) {
      num += Math.floor(Math.random() * 10).toString();
    }
    return `${num.slice(0, 4)} ${num.slice(4, 8)} ${num.slice(8, 12)} ${num.slice(12, 16)}`;
  }

  async createVirtualCard(
    user: { id: string; role: UserRole },
    dto: CreateCardDto,
  ): Promise<Omit<VirtualCard, 'cvv'>> {
    const account = await this.accountRepo.findOne({
      where: { id: dto.accountId },
      relations: ['user'],
    });

    if (!account) {
      throw new NotFoundException(`Compte introuvable`);
    }

    if (user.role === UserRole.CLIENT && account.userId !== user.id) {
      throw new ForbiddenException(`Vous ne pouvez pas commander de carte sur ce compte`);
    }

    // Expiry: 3 years from today (MM/YY)
    const now = new Date();
    const expiryMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    const expiryYear = (now.getFullYear() + 3).toString().slice(-2);
    const expiry = `${expiryMonth}/${expiryYear}`;

    const cvv = Math.floor(100 + Math.random() * 900).toString();
    const cardHolder = account.user
      ? `${account.user.firstName.toUpperCase()} ${account.user.lastName.toUpperCase()}`
      : 'CLIENT AURA BANK';

    const card = this.cardRepo.create({
      accountId: account.id,
      cardNumber: this.generateCardNumber(),
      cardHolder,
      expiry,
      cvv,
      dailyLimit: dto.dailyLimit || 1000.0,
      monthlyLimit: dto.monthlyLimit || 3000.0,
      dailySpent: 0.0,
      monthlySpent: 0.0,
      status: CardStatus.ACTIVE,
    });

    const savedCard = await this.cardRepo.save(card);

    await this.auditService.log({
      userId: user.id,
      userRole: user.role,
      action: 'CARD_CREATED',
      resource: `Card:${savedCard.cardNumber.slice(-4)}`,
      details: `Création carte virtuelle pour compte ${account.accountNumber}`,
    });

    return this.toPublicCard(savedCard);
  }

  async getAccountCards(
    accountId: string,
    user: { id: string; role: UserRole },
  ): Promise<Partial<Omit<VirtualCard, 'cvv'>>[]> {
    const account = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!account) {
      throw new NotFoundException('Compte introuvable');
    }
    if (user.role === UserRole.CLIENT && account.userId !== user.id) {
      throw new ForbiddenException('Vous ne pouvez pas consulter les cartes de ce compte');
    }
    const cards = await this.cardRepo.find({
      where: { accountId },
      order: { createdAt: 'DESC' },
    });
    return cards.map((card) => this.toPublicCard(card));
  }

  async toggleCardFreeze(
    cardId: string,
    user: { id: string; role: UserRole },
  ): Promise<Omit<VirtualCard, 'cvv'>> {
    const card = await this.cardRepo.findOne({
      where: { id: cardId },
      relations: ['account'],
    });

    if (!card) {
      throw new NotFoundException(`Carte introuvable`);
    }

    if (user.role === UserRole.CLIENT && card.account.userId !== user.id) {
      throw new ForbiddenException(`Opération non autorisée`);
    }

    card.status = card.status === CardStatus.ACTIVE ? CardStatus.FROZEN : CardStatus.ACTIVE;
    const updated = await this.cardRepo.save(card);

    await this.auditService.log({
      userId: user.id,
      userRole: user.role,
      action: 'CARD_STATUS_TOGGLED',
      resource: `Card:${card.cardNumber.slice(-4)}`,
      details: `Nouveau statut: ${card.status}`,
    });

    return this.toPublicCard(updated);
  }

  private toPublicCard(card: VirtualCard): Omit<VirtualCard, 'cvv'> {
    const { cvv: _cvv, ...publicCard } = card;
    return {
      ...publicCard,
      cardNumber: `•••• •••• •••• ${card.cardNumber.slice(-4)}`,
    };
  }

  /**
   * Simulates an online or POS card payment with daily & monthly ceiling controls
   */
  async processCardPayment(
    cardId: string,
    dto: CardPaymentDto,
    user: { id: string; role: UserRole },
    idempotencyKey?: string,
  ): Promise<{ success: boolean; message: string; remainingDailyLimit: number }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    if (this.dataSource.options.type === 'sqlite') {
      await queryRunner.query('PRAGMA busy_timeout = 30000');
    }
    await queryRunner.startTransaction();

    let card: VirtualCard;
    let paymentDescription: string;
    let remainingDailyLimit: number;
    let wasReplay = false;
    try {
      const cardQuery = queryRunner.manager
        .createQueryBuilder(VirtualCard, 'card')
        .innerJoinAndSelect('card.account', 'account')
        .where('card.id = :id', { id: cardId });
      if (this.dataSource.options.type === 'postgres') {
        cardQuery.setLock('pessimistic_write');
      } else if (this.dataSource.options.type === 'sqlite') {
        await queryRunner.manager.increment(VirtualCard, { id: cardId }, 'dailySpent', 0);
      }
      card = await cardQuery.getOne();
      if (!card) {
        throw new NotFoundException('Carte introuvable');
      }
      if (user.role === UserRole.CLIENT && card.account.userId !== user.id) {
        throw new ForbiddenException('Vous ne pouvez pas utiliser cette carte');
      }
      if (card.status !== CardStatus.ACTIVE) {
        throw new BadRequestException(`Paiement refusé : La carte est ${card.status}`);
      }

      const today = new Date().toISOString().slice(0, 10);
      const currentMonth = today.slice(0, 7);
      const paymentAmount = new Decimal(dto.amount);
      const dailySpent = new Decimal(card.dailySpentDate === today ? card.dailySpent : 0);
      const dailyLimit = new Decimal(card.dailyLimit);
      const monthlySpent = new Decimal(
        card.monthlySpentPeriod === currentMonth ? card.monthlySpent : 0,
      );
      const monthlyLimit = new Decimal(card.monthlyLimit);

      const merchantAccount = await queryRunner.manager.findOne(Account, {
        where: { accountType: AccountType.INTERNAL_FEES },
      });
      const paymentAccount =
        merchantAccount ||
        (await queryRunner.manager.save(
          queryRunner.manager.create(Account, {
            accountNumber: 'FR76 BANK 0000 0000 0000 FEES 001',
            accountType: AccountType.INTERNAL_FEES,
            balance: 0.0,
          }),
        ));

      const postings = [
        {
          accountId: card.accountId,
          direction: PostingDirection.DEBIT,
          amount: dto.amount,
        },
        {
          accountId: paymentAccount.id,
          direction: PostingDirection.CREDIT,
          amount: dto.amount,
        },
      ];
      const existing = await this.ledgerService.findIdempotentJournalEntry({
        idempotencyKey,
        transactionType: TransactionType.CARD_PAYMENT,
        postings,
      });
      if (existing) {
        wasReplay = true;
      } else {
        if (dailySpent.plus(paymentAmount).greaterThan(dailyLimit)) {
          throw new BadRequestException(
            `Paiement refusé : Plafond quotidien dépassé (${dailySpent.toFixed(2)} / ${dailyLimit.toFixed(2)} EUR)`,
          );
        }
        if (monthlySpent.plus(paymentAmount).greaterThan(monthlyLimit)) {
          throw new BadRequestException(
            `Paiement refusé : Plafond mensuel dépassé (${monthlySpent.toFixed(2)} / ${monthlyLimit.toFixed(2)} EUR)`,
          );
        }

        paymentDescription = `Paiement Carte [${dto.merchant}] - Finissant par ${card.cardNumber.slice(-4)}`;
        await this.ledgerService.executeJournalEntry(
          {
            idempotencyKey,
            transactionType: TransactionType.CARD_PAYMENT,
            description: paymentDescription,
            postings,
          },
          queryRunner,
        );

        card.dailySpent = dailySpent.plus(paymentAmount).toNumber();
        card.dailySpentDate = today;
        card.monthlySpent = monthlySpent.plus(paymentAmount).toNumber();
        card.monthlySpentPeriod = currentMonth;
        await queryRunner.manager.save(card);
      }

      const chargedToday = card.dailySpentDate === today ? card.dailySpent : 0;
      remainingDailyLimit = dailyLimit.minus(chargedToday).toNumber();
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    await this.auditService.log({
      userId: user.id,
      userRole: user.role,
      action: wasReplay ? 'CARD_PAYMENT_REPLAYED' : 'CARD_PAYMENT_COMPLETED',
      resource: `Card:${card.cardNumber.slice(-4)}`,
      details: paymentDescription || `Paiement de ${dto.amount.toFixed(2)} EUR chez ${dto.merchant}`,
    });

    return {
      success: true,
      message: wasReplay
        ? `Ce paiement a déjà été enregistré`
        : `Paiement de ${dto.amount.toFixed(2)} EUR autorisé chez ${dto.merchant}`,
      remainingDailyLimit,
    };
  }
}
