import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  Ip,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LoansService } from './loans.service';
import { SimulateLoanDto, ApplyLoanDto } from './dto/loan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@ApiTags('Loans (Prêts & Crédits)')
@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post('simulate')
  @ApiOperation({ summary: 'Simuler un prêt et générer un échéancier d’amortissement sans engagement' })
  simulate(@Body() dto: SimulateLoanDto) {
    return this.loansService.calculateSimulation(dto);
  }

  @Post('apply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soumettre une demande officielle de prêt' })
  async apply(
    @Body() dto: ApplyLoanDto,
    @Req() req: any,
    @Ip() ip: string,
  ) {
    return this.loansService.applyForLoan(req.user.id, dto, ip);
  }

  @Get('my-loans')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consulter mes prêts en cours' })
  async getMyLoans(@Req() req: any) {
    return this.loansService.getLoansByUser(req.user.id);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ADVISOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister toutes les demandes de prêts (Conseillers / Admins)' })
  async getAllLoans(@Query('limit') limit?: number) {
    return this.loansService.getAllLoans(limit ? Number(limit) : 50);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ADVISOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Valider un prêt et verser les fonds au compte client via le Grand Livre' })
  async approveLoan(@Param('id') id: string, @Req() req: any) {
    return this.loansService.approveLoan(id, req.user);
  }
}
