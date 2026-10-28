import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, IsString, IsOptional, IsUUID, Max } from 'class-validator';

export class TransferDto {
  @ApiProperty({ description: 'ID du compte émetteur' })
  @IsUUID()
  @IsNotEmpty()
  sourceAccountId: string;

  @ApiProperty({ description: 'ID ou IBAN du compte destinataire' })
  @IsString()
  @IsNotEmpty()
  destinationIdentifier: string; // Accepts UUID or IBAN

  @ApiProperty({ description: 'Montant du virement en EUR', example: 150.50 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(9999999999999999)
  amount: number;

  @ApiPropertyOptional({ description: 'Motif du virement', default: 'Virement bancaire' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class DepositDto {
  @ApiProperty({ description: 'ID du compte à créditer' })
  @IsUUID()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({ description: 'Montant du dépôt en EUR', example: 500.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(9999999999999999)
  amount: number;

  @ApiPropertyOptional({ description: 'Référence du versement', default: 'Dépôt d’espèces en agence' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class WithdrawalDto {
  @ApiProperty({ description: 'ID du compte à débiter' })
  @IsUUID()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({ description: 'Montant du retrait en EUR', example: 200.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(9999999999999999)
  amount: number;

  @ApiPropertyOptional({ description: 'Motif du retrait', default: 'Retrait d’espèces' })
  @IsString()
  @IsOptional()
  description?: string;
}
