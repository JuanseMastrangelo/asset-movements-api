import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsDateString,
  IsNumber,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTransactionDetailDto } from './create-transaction-detail.dto';

export class CreatePartialTransactionDto {
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
    description: 'Notas adicionales sobre la transacción',
    required: false,
    example: 'Pago parcial del 50% de USD a EUR',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Detalles de la transacción completa (movimientos de activos)',
    type: [CreateTransactionDetailDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionDetailDto)
  details: CreateTransactionDetailDto[];

  @ApiProperty({
    description: 'Porcentaje inicial a completar (entre 1 y 99)',
    required: false,
    example: 50,
    minimum: 1,
    maximum: 99,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(99)
  initialPercentage?: number;

  @ApiProperty({
    description:
      'Si es true, los montos se manejan directamente, no como porcentaje',
    required: false,
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  useDirectAmounts?: boolean;

  @ApiProperty({
    description:
      'Fecha estimada para completar la transacción (formato ISO8601)',
    required: false,
    example: '2023-01-15T12:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  estimatedCompletionDate?: string;
}
