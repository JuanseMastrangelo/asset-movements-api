import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsPositive,
  IsUUID,
  IsArray,
  ValidateNested,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { MovementType } from '@prisma/client';

class ClientTransactionDto {
  @ApiProperty({
    description: 'ID del cliente',
    example: '22222222-2222-2222-2222-222222222222',
  })
  @IsUUID()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({
    description: 'ID del activo inmutable (Cable llevar o Cable traer)',
    example: '12345678-1234-1234-1234-123456789012',
  })
  @IsUUID()
  @IsNotEmpty()
  assetId: string;

  @ApiProperty({
    description: 'Tipo de movimiento (INCOME o EXPENSE)',
    enum: MovementType,
    example: MovementType.INCOME,
  })
  @IsEnum(MovementType)
  movementType: MovementType;

  @ApiProperty({
    description: 'Monto de la transacción para este cliente',
    example: 3000,
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    description: 'Notas adicionales sobre esta transacción particular',
    required: false,
    example: 'Cable llevar para cliente X',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ConciliateImmutableAssetsDto {
  @ApiProperty({
    description: 'Lista de clientes y sus transacciones',
    type: [ClientTransactionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClientTransactionDto)
  clientTransactions: ClientTransactionDto[];

  @ApiProperty({
    description: 'Notas generales sobre la operación',
    required: false,
    example: 'Pase de Cable llevar/traer entre varios clientes',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
