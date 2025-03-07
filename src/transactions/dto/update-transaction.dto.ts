import { PartialType } from '@nestjs/swagger';
import { CreateTransactionDto } from './create-transaction.dto';
import { CreateTransactionDetailDto } from './create-transaction-detail.dto';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsDateString,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {
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
    example: 'Actualización de la transacción original',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Nuevos detalles de la transacción',
    required: false,
    type: [CreateTransactionDetailDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionDetailDto)
  details?: CreateTransactionDetailDto[];

  @ApiProperty({
    description:
      'Si es true, los nuevos detalles reemplazarán a los existentes. Si es false, se añadirán.',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  replaceDetails?: boolean;
}
