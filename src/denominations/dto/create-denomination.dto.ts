import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateDenominationDto {
  @ApiProperty({
    description: 'ID del activo al que pertenece la denominación',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  assetId: string;

  @ApiProperty({
    description: 'Valor de la denominación (ej. 50, 20, 10, 5, 1, etc.)',
    example: 50,
  })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  value: number;

  @ApiProperty({
    description: 'Indica si la denominación está activa',
    default: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
