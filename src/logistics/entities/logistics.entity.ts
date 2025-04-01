import { ApiProperty } from '@nestjs/swagger';
import { PaymentResponsibility } from '@prisma/client';

export class Logistics {
  @ApiProperty({
    description: 'ID único de la logística',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'ID de la transacción asociada',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  transactionId: string;

  @ApiProperty({
    description: 'Información de la transacción asociada',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      clientId: '550e8400-e29b-41d4-a716-446655440002',
      state: 'CURRENT_ACCOUNT',
    },
  })
  transaction?: any;

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
  distance?: number;

  @ApiProperty({
    description: 'Precio calculado para la entrega',
    example: 1025.5,
  })
  price?: number;

  @ApiProperty({
    description: 'Precio por kilómetro aplicado',
    example: 50,
  })
  pricePerKm?: number;

  @ApiProperty({
    description: 'Fecha y hora estimada de entrega',
    example: '2023-05-20T14:30:00Z',
  })
  deliveryDate?: Date;

  @ApiProperty({
    description: 'Notas adicionales',
    example: 'Llamar antes de entregar',
  })
  note?: string;

  @ApiProperty({
    description: 'Responsabilidad de pago',
    enum: PaymentResponsibility,
    example: 'CLIENT',
  })
  paymentResponsibility: PaymentResponsibility;

  @ApiProperty({
    description: 'Estado de la logística',
    example: 'PENDING',
  })
  status?: string;

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
