import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsOptional,
  IsDateString,
  IsEnum,
  IsNumber,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionState } from '@prisma/client';

export class SearchTransactionsDto {
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
    description: 'ID del activo involucrado en los detalles',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @ApiProperty({
    description: 'Número máximo de resultados',
    required: false,
    default: 20,
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  limit?: number;

  @ApiProperty({
    description: 'Desplazamiento para paginación',
    required: false,
    default: 0,
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  offset?: number;

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
