import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LedgerService } from './ledger.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@ApiTags('Ledger (Double-Entry Engine)')
@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get('entries')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ADVISOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtenir les écritures récentes du grand livre (Admin/Conseiller)' })
  async getRecentEntries(@Query('limit') limit?: number) {
    return this.ledgerService.getRecentJournalEntries(limit ? Number(limit) : 20);
  }

  @Get('account/:id/postings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtenir l’historique des débits/crédits d’un compte spécifique' })
  async getAccountPostings(
    @Param('id') id: string,
    @Req() req: any,
    @Query('limit') limit?: number,
  ) {
    return this.ledgerService.getAccountPostings(
      id,
      limit ? Number(limit) : 50,
      req.user,
    );
  }

  @Get('account/:id/reconcile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ADVISOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vérifier la réconciliation et intégrité mathématique d’un compte (Auditeur/Admin)' })
  async reconcileAccount(@Param('id') id: string) {
    return this.ledgerService.reconcileAccount(id);
  }
}
