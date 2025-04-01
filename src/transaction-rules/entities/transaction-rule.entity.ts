import { ApiProperty } from '@nestjs/swagger';

export class TransactionRule {
  @ApiProperty({
    description: 'ID único de la regla de transacción',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'ID del activo de origen',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  sourceAssetId: string;

  @ApiProperty({
    description: 'ID del activo de destino',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  targetAssetId: string;

  @ApiProperty({
    description: 'Información del activo de origen',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Dólar Estadounidense',
      description: 'USD',
    },
  })
  sourceAsset?: any;

  @ApiProperty({
    description: 'Información del activo de destino',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Peso Argentino',
      description: 'ARS',
    },
  })
  targetAsset?: any;

  @ApiProperty({
    description: 'Indica si la regla está habilitada',
    example: true,
  })
  isEnabled: boolean;

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
