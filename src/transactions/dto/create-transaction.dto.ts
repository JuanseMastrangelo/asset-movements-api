import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsOptional,
  IsString,
  IsEnum,
  IsArray,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionState } from '@prisma/client';
import { CreateTransactionDetailDto } from './create-transaction-detail.dto';

export class CreateTransactionDto {
  @ApiProperty({
    description: 'ID del cliente',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  clientId: string;

  @ApiProperty({
    description: 'Fecha de la transacción (formato ISO8601)',
    required: false,
    example: '2023-01-01T12:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({
    description: 'Estado de la transacción',
    enum: TransactionState,
    default: TransactionState.PENDING,
    required: false,
  })
  @IsOptional()
  @IsEnum(TransactionState)
  state?: TransactionState;

  @ApiProperty({
    description: 'Notas adicionales sobre la transacción',
    required: false,
    example: 'Cambio de dólares a euros',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'ID de la transacción padre (para transacciones relacionadas)',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  parentTransactionId?: string;

  @ApiProperty({
    description: 'Detalles de la transacción (movimientos de activos)',
    type: [CreateTransactionDetailDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionDetailDto)
  details?: CreateTransactionDetailDto[];
}
