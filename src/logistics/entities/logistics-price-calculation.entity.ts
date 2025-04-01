import { ApiProperty } from '@nestjs/swagger';

export class LogisticsPriceCalculation {
  @ApiProperty({
    description: 'Dirección de origen',
    example: 'Av. Córdoba 123, Buenos Aires, Argentina',
  })
  originAddress: string;

  @ApiProperty({
    description: 'Dirección de destino',
    example: 'Av. Santa Fe 456, Buenos Aires, Argentina',
  })
  destinationAddress: string;

  @ApiProperty({
    description: 'Distancia calculada en kilómetros',
    example: 10.5,
  })
  distance: number;

  @ApiProperty({
    description: 'Precio base aplicado',
    example: 500,
  })
  basePrice: number;

  @ApiProperty({
    description: 'Precio por kilómetro aplicado',
    example: 50,
  })
  pricePerKm: number;

  @ApiProperty({
    description: 'Precio total calculado',
    example: 1025.5,
  })
  totalPrice: number;

  @ApiProperty({
    description: 'Configuración usada para el cálculo',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Tarifa Urbana',
    },
  })
  settingsUsed?: any;
}
