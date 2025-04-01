import { ApiProperty } from '@nestjs/swagger';

export class LogisticsSettings {
  @ApiProperty({
    description: 'ID único de la configuración',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Nombre de la configuración',
    example: 'Tarifa Urbana',
  })
  name: string;

  @ApiProperty({
    description: 'Precio base para cualquier entrega',
    example: 500,
  })
  basePrice: number;

  @ApiProperty({
    description: 'Precio por kilómetro',
    example: 50,
  })
  pricePerKm: number;

  @ApiProperty({
    description: 'Distancia mínima para aplicar precio (opcional)',
    example: 1,
  })
  minDistance?: number;

  @ApiProperty({
    description: 'Distancia máxima para aplicar precio (opcional)',
    example: 50,
  })
  maxDistance?: number;

  @ApiProperty({
    description: 'Si está activa esta configuración',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Fecha de creación',
    example: '2023-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de última actualización',
    example: '2023-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}
