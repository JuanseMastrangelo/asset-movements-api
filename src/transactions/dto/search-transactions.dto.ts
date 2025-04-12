import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsOptional,
  IsDateString,
  IsEnum,
  IsNumber,
  Min,
  IsBoolean,
  IsString,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionState } from '@prisma/client';

export class SearchTransactionsDto {
  @ApiProperty({
    description: 'Página para paginación',
    required: false,
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiProperty({
    description: 'Número de elementos por página',
    required: false,
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @ApiProperty({
    description: 'ID del cliente',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiProperty({
    description: 'Fecha de inicio (formato ISO8601)',
    required: false,
    example: '2023-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'Fecha de fin (formato ISO8601)',
    required: false,
    example: '2023-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'Estado de la transacción',
    required: false,
    enum: TransactionState,
    example: TransactionState.PENDING,
  })
  @IsOptional()
  @IsEnum(TransactionState)
  state?: TransactionState;

  @ApiProperty({
    description: 'ID de la transacción padre',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  parentTransactionId?: string;

  @ApiProperty({
    description: 'ID de la transacción hija (para encontrar el padre)',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  childTransactionId?: string;

  @ApiProperty({
    description: 'ID del activo involucrado en los detalles',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @ApiProperty({
    description: 'Monto mínimo',
    required: false,
    example: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minAmount?: number;

  @ApiProperty({
    description: 'Monto máximo',
    required: false,
    example: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxAmount?: number;

  @ApiProperty({
    description: 'Campo para ordenar',
    required: false,
    example: 'date',
    enum: ['date', 'amount', 'createdAt', 'updatedAt'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['date', 'amount', 'createdAt', 'updatedAt'])
  sortBy?: string;

  @ApiProperty({
    description: 'Orden (asc o desc)',
    required: false,
    example: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiProperty({
    description: 'Incluir transacciones canceladas en los resultados',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeCancelled?: boolean;
}
