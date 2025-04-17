import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FindClientsForReconciliationDto {
  @ApiProperty({
    description:
      'ID del activo para el cual buscar clientes con balances disponibles para conciliación',
    example: '12345678-1234-1234-1234-123456789012',
  })
  @IsString()
  @IsNotEmpty()
  assetId: string;
}
