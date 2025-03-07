import { IsString } from 'class-validator';

import { IsOptional } from 'class-validator';

import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsNumber, Min } from 'class-validator';

import { IsEnum } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { MovementType } from '@prisma/client';
import { IsUUID } from 'class-validator';

export class CreateTransactionDetailDto {
  @ApiProperty({
    description: 'ID del activo asociado al movimiento',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  assetId: string;

  @ApiProperty({
    description: 'Tipo de movimiento (ingreso o egreso)',
    enum: MovementType,
  })
  @IsEnum(MovementType)
  movementType: MovementType;

  @ApiProperty({
    description: 'Monto del movimiento',
    example: 1500.5,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({
    description:
      'Diferencia de porcentaje (para activos con isPercentage=true)',
    example: 3.5,
  })
  @IsOptional()
  @IsNumber()
  percentageDifference?: number;

  @ApiPropertyOptional({
    description: 'Notas específicas sobre este movimiento',
    example: 'Dólares cara grande serie 2009',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
