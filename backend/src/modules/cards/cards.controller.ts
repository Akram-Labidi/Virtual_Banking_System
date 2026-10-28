import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CardsService } from './cards.service';
import { CreateCardDto, CardPaymentDto } from './dto/card.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Virtual Cards & Limits')
@Controller('cards')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post()
  @ApiOperation({ summary: 'Commander une nouvelle carte bancaire virtuelle' })
  async createCard(@Body() dto: CreateCardDto, @Req() req: any) {
    return this.cardsService.createVirtualCard(req.user, dto);
  }

  @Get('account/:accountId')
  @ApiOperation({ summary: 'Lister les cartes virtuelles d’un compte' })
  async getCards(@Param('accountId') accountId: string, @Req() req: any) {
    return this.cardsService.getAccountCards(accountId, req.user);
  }

  @Patch(':id/toggle-freeze')
  @ApiOperation({ summary: 'Verrouiller / Déverrouiller instantanément une carte virtuelle' })
  async toggleFreeze(@Param('id') id: string, @Req() req: any) {
    return this.cardsService.toggleCardFreeze(id, req.user);
  }

  @Post(':id/simulate-payment')
  @ApiOperation({ summary: 'Simuler un paiement par carte (vérifie les plafonds & débite le ledger)' })
  async simulatePayment(
    @Param('id') id: string,
    @Body() dto: CardPaymentDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Req() req: any,
  ) {
    return this.cardsService.processCardPayment(id, dto, req.user, idempotencyKey);
  }
}
