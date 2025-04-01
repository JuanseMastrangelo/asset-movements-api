import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsPositive,
  Min,
  IsBoolean,
} from 'class-validator';

export class CreateLogisticsSettingsDto {
  @ApiProperty({
    description: 'Nombre de la configuración',
    example: 'Tarifa Urbana',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Precio base para cualquier entrega',
    example: 500,
  })
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiProperty({
    description: 'Precio por kilómetro',
    example: 50,
  })
  @IsNumber()
  @Min(0)
  pricePerKm: number;

  @ApiProperty({
    description: 'Distancia mínima para aplicar precio (opcional)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  minDistance?: number;

  @ApiProperty({
    description: 'Distancia máxima para aplicar precio (opcional)',
    example: 50,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  maxDistance?: number;

  @ApiProperty({
    description: 'Si está activa esta configuración',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
