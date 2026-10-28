import { Controller, Get, Patch, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FraudService } from './fraud.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@ApiTags('Fraud Detection (Surveillance & Conformité)')
@Controller('fraud')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class FraudController {
  constructor(private readonly fraudService: FraudService) {}

  @Get('alerts')
  @Roles(UserRole.ADMIN, UserRole.ADVISOR)
  @ApiOperation({ summary: 'Lister les alertes de fraude (Conseiller/Admin)' })
  async getAlerts(
    @Query('limit') limit?: number,
    @Query('unresolvedOnly') unresolvedOnly?: string,
  ) {
    return this.fraudService.getAllAlerts(
      limit ? Number(limit) : 50,
      unresolvedOnly === 'true',
    );
  }

  @Patch('alerts/:id/resolve')
  @Roles(UserRole.ADMIN, UserRole.ADVISOR)
  @ApiOperation({ summary: 'Résoudre ou classer une alerte de fraude' })
  async resolveAlert(
    @Param('id') id: string,
    @Body('notes') notes: string,
    @Req() req: any,
  ) {
    return this.fraudService.resolveAlert(id, req.user?.email || 'ADVISOR', notes);
  }
}
