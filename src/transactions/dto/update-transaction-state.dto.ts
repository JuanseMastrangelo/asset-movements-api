import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { TransactionState } from '@prisma/client';
import { Type } from 'class-transformer';
import { CreateTransactionDetailDto } from './create-transaction-detail.dto';

export class UpdateTransactionStateDto {
  @ApiProperty({
    description: 'Nuevo estado de la transacción',
    enum: TransactionState,
  })
  @IsEnum(TransactionState)
  state: TransactionState;

  @ApiProperty({
    description: 'Notas o comentarios sobre el cambio de estado (opcional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Detalles actualizados de la transacción (opcional)',
    type: [CreateTransactionDetailDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionDetailDto)
  updatedDetails?: CreateTransactionDetailDto[];
}
