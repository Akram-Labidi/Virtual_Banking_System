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
import { ApiProperty } from '@nestjs/swagger';
import { ForbiddenException } from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccountStatus, UserRole } from '../../common/enums';

class UpdateAccountStatusDto {
  @ApiProperty({ enum: AccountStatus })
  @IsEnum(AccountStatus)
  status: AccountStatus;
}

@ApiTags('Accounts (Gestion des Comptes)')
@Controller('accounts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Ouvrir un nouveau compte (Courant ou Épargne)' })
  async createAccount(
    @Body() dto: CreateAccountDto,
    @Req() req: any,
    @Ip() ip: string,
  ) {
    return this.accountsService.createAccount(req.user.id, dto, ip);
  }

  @Get('my-accounts')
  @ApiOperation({ summary: 'Lister les comptes de l’utilisateur connecté' })
  async getMyAccounts(@Req() req: any) {
    return this.accountsService.getAccountsByUser(req.user.id);
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ADVISOR)
  @ApiOperation({ summary: 'Lister tous les comptes bancaires (Conseiller / Admin)' })
  async getAllAccounts(@Query('limit') limit?: number) {
    return this.accountsService.getAllAccounts(limit ? Number(limit) : 100);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détails d’un compte spécifique' })
  async getAccountById(@Param('id') id: string, @Req() req: any) {
    const account = await this.accountsService.getAccountById(id);
    if (req.user.role === UserRole.CLIENT && account.userId !== req.user.id) {
      throw new ForbiddenException('Vous ne pouvez pas consulter ce compte');
    }
    return account;
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ADVISOR)
  @ApiOperation({ summary: 'Bloquer, débloquer ou clôturer un compte' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAccountStatusDto,
    @Req() req: any,
  ) {
    return this.accountsService.updateAccountStatus(id, dto.status, req.user);
  }
}
