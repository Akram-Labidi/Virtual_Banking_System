import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsPositive, IsUUID, Max, Min } from 'class-validator';

export class SimulateLoanDto {
  @ApiProperty({ description: 'Montant emprunté en EUR', example: 10000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(9999999999999999)
  principalAmount: number;

  @ApiProperty({ description: 'Taux annuel d’intérêt en %', example: 3.8 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  @Max(30.0)
  annualInterestRate: number;

  @ApiProperty({ description: 'Durée en mois', example: 24 })
  @IsInt()
  @Min(6)
  @Max(360)
  termMonths: number;
}

export class ApplyLoanDto extends SimulateLoanDto {
  @ApiProperty({ description: 'Compte bancaire vers lequel verser les fonds' })
  @IsUUID()
  @IsNotEmpty()
  accountId: string;
}
