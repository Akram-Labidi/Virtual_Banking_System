import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { AccountType } from '../../../common/enums';

export class CreateAccountDto {
  @ApiProperty({ enum: AccountType, default: AccountType.CHECKING })
  @IsEnum(AccountType)
  @IsNotEmpty()
  accountType: AccountType;

  @ApiPropertyOptional({ description: 'Dépôt initial facultatif', default: 0.0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999999999)
  @IsOptional()
  initialDeposit?: number;
}
