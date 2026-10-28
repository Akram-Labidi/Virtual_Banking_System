import {
  Controller,
  Post,
  Body,
  Headers,
  UseGuards,
  Req,
  Ip,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { TransferDto, DepositDto, WithdrawalDto } from './dto/transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Transactions & Operations')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('transfer')
  @ApiOperation({ summary: 'Effectuer un virement sécurisé avec grand livre et idempotence' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Clé unique pour garantir l’exécution unique en cas de double-clic ou retry',
  })
  async transfer(
    @Body() dto: TransferDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Req() req: any,
    @Ip() ip: string,
  ) {
    return this.transactionsService.executeTransfer(
      req.user,
      dto,
      idempotencyKey,
      ip,
    );
  }

  @Post('deposit')
  @ApiOperation({ summary: 'Effectuer un versement / dépôt de fonds' })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  async deposit(
    @Body() dto: DepositDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Req() req: any,
    @Ip() ip: string,
  ) {
    return this.transactionsService.executeDeposit(
      req.user,
      dto,
      idempotencyKey,
      ip,
    );
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Effectuer un retrait de fonds' })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  async withdraw(
    @Body() dto: WithdrawalDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Req() req: any,
    @Ip() ip: string,
  ) {
    return this.transactionsService.executeWithdrawal(
      req.user,
      dto,
      idempotencyKey,
      ip,
    );
  }
}
