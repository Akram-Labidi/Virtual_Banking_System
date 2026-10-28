import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@ApiTags('Audit & Compliance (Journal Immuable)')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @Roles(UserRole.ADMIN, UserRole.ADVISOR)
  @ApiOperation({ summary: 'Consulter le journal d’audit immuable' })
  async getLogs(@Query('limit') limit?: number) {
    return this.auditService.getLogs(limit ? Number(limit) : 100);
  }

  @Get('logs/:id/verify')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Vérifier l’intégrité cryptographique SHA-256 d’une entrée d’audit' })
  async verifyIntegrity(@Param('id') id: string) {
    return this.auditService.verifyIntegrity(id);
  }
}
