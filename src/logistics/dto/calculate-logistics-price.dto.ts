import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CalculateLogisticsPriceDto {
  @ApiProperty({
    description: 'Dirección de origen',
    example: 'Av. Córdoba 123, Buenos Aires, Argentina',
  })
  @IsString()
  originAddress: string;

  @ApiProperty({
    description: 'Dirección de destino',
    example: 'Av. Santa Fe 456, Buenos Aires, Argentina',
  })
  @IsString()
  destinationAddress: string;

  @ApiProperty({
    description:
      'ID de la configuración de precios a usar (opcional, usa la activa por defecto)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  settingsId?: string;
}
