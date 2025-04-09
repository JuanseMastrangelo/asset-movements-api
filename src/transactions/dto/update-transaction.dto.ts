import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsUUID,
  IsString,
  IsDateString,
  IsArray,
  ValidateNested,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTransactionDetailDto } from './create-transaction-detail.dto';
import { TransactionState } from '@prisma/client';

export class UpdateTransactionDto {
  @ApiProperty({
    description: 'ID del cliente',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  clientId?: string;

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
    description: 'Detalles actualizados de la transacción',
    type: [CreateTransactionDetailDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionDetailDto)
  details?: CreateTransactionDetailDto[];

  @ApiProperty({
    description: 'Porcentaje de la transacción que se está completando (1-100)',
    required: false,
    minimum: 1,
    maximum: 100,
    example: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  completionPercentage?: number;

  @ApiProperty({
    description: 'Si es true, crea una transacción hija para el restante',
    required: false,
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  createChildForRemaining?: boolean;
}
