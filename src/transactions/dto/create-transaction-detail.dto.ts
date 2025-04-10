import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { MovementType } from '@prisma/client';
import { Type } from 'class-transformer';
import { BillDetailDto } from './bill-detail.dto';

export class CreateTransactionDetailDto {
  @ApiProperty({
    description: 'ID del activo',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  assetId: string;

  @ApiProperty({
    description: 'Tipo de movimiento',
    enum: MovementType,
    example: MovementType.INCOME,
  })
  @IsEnum(MovementType)
  movementType: MovementType;

  @ApiProperty({
    description: 'Cantidad',
    example: 1000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    description: 'Diferencia porcentual (opcional)',
    required: false,
    example: 5.5,
  })
  @IsOptional()
  @IsNumber()
  percentageDifference?: number;

  @ApiProperty({
    description: 'Notas adicionales (opcional)',
    required: false,
    example: 'Notas sobre el detalle',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Detalles de billetes (desglose por denominación)',
    type: [BillDetailDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillDetailDto)
  billDetails?: BillDetailDto[];
}
