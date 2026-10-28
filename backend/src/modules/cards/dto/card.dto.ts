import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max, MaxLength } from 'class-validator';

export class CreateCardDto {
  @ApiProperty({ description: 'ID du compte associé à la carte' })
  @IsUUID()
  @IsNotEmpty()
  accountId: string;

  @ApiPropertyOptional({ description: 'Plafond de paiement quotidien (EUR)', default: 1000.0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(9999999999999999)
  @IsOptional()
  dailyLimit?: number;

  @ApiPropertyOptional({ description: 'Plafond de paiement mensuel (EUR)', default: 3000.0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(9999999999999999)
  @IsOptional()
  monthlyLimit?: number;
}

export class CardPaymentDto {
  @ApiProperty({ description: 'Montant du paiement (EUR)', example: 45.90 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(9999999999999999)
  amount: number;

  @ApiProperty({ description: 'Nom du commerçant / description', example: 'Amazon France' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  merchant: string;
}
