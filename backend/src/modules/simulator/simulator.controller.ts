import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SimulatorService } from './simulator.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@ApiTags('Simulator (Générateur de Trafic Client)')
@Controller('simulator')
export class SimulatorController {
  constructor(private readonly simulatorService: SimulatorService) {}

  @Get('status')
  @ApiOperation({ summary: 'Consulter l’état et les métriques du simulateur de trafic' })
  getStatus() {
    return this.simulatorService.getStatus();
  }

  @Post('start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ADVISOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Démarrer le simulateur de trafic automatique (Admin / Conseiller)' })
  start(@Body('intervalMs') intervalMs?: number) {
    return this.simulatorService.start(intervalMs || 3000);
  }

  @Post('stop')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ADVISOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Arrêter le simulateur de trafic' })
  stop() {
    return this.simulatorService.stop();
  }
}
