import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateTransactionRuleDto {
  @ApiProperty({
    description: 'ID del activo de origen',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty()
  @IsUUID()
  sourceAssetId: string;

  @ApiProperty({
    description: 'ID del activo de destino',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsNotEmpty()
  @IsUUID()
  targetAssetId: string;

  @ApiProperty({
    description: 'Indica si la regla está habilitada',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
