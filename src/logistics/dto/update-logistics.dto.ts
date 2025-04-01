import { PartialType } from '@nestjs/swagger';
import { CreateLogisticsDto } from './create-logistics.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateLogisticsDto extends PartialType(CreateLogisticsDto) {
  @ApiProperty({
    description: 'Distancia calculada en kilómetros',
    example: 10.5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  distance?: number;

  @ApiProperty({
    description: 'Precio calculado para la entrega',
    example: 1025.5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiProperty({
    description: 'Precio por kilómetro aplicado',
    example: 50,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerKm?: number;
}
