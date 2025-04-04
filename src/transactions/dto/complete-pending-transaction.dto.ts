import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsDateString,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTransactionDetailDto } from './create-transaction-detail.dto';

export class CompletePendingTransactionDto {
  @ApiProperty({
    description: 'Notas adicionales sobre la transacción',
    required: false,
    example: 'Completando el pago pendiente',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Fecha de completado (formato ISO8601)',
    required: false,
    example: '2023-01-01T12:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  completionDate?: string;

  @ApiProperty({
    description:
      'Porcentaje a completar (0-100). Default 100 para completar todo',
    required: false,
    example: 100,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  completionPercentage?: number;

  @ApiProperty({
    description:
      'Detalles personalizados para completar la transacción (opcional)',
    type: [CreateTransactionDetailDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionDetailDto)
  customDetails?: CreateTransactionDetailDto[];
}
