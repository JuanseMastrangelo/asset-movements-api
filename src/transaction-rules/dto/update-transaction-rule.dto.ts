import { PartialType } from '@nestjs/swagger';
import { CreateTransactionRuleDto } from './create-transaction-rule.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTransactionRuleDto extends PartialType(
  CreateTransactionRuleDto,
) {
  @ApiProperty({
    description: 'Indica si la regla está habilitada',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
