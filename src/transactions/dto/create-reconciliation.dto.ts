import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class ReconciliationTargetDto {
  @ApiProperty({
    description: 'ID del cliente destino que recibirá fondos',
    example: '22222222-2222-2222-2222-222222222222',
  })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({
    description:
      'ID del activo a conciliar (debe coincidir con el activo origen)',
    example: '12345678-1234-1234-1234-123456789012',
  })
  @IsString()
  @IsNotEmpty()
  assetId: string;

  @ApiProperty({
    description: 'Monto a conciliar para este cliente destino',
    example: 3000,
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    description: 'Notas adicionales sobre esta conciliación particular',
    required: false,
    example: 'Conciliación parcial',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateReconciliationDto {
  @ApiProperty({
    description: 'ID de la transacción origen de donde provienen los fondos',
    example: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  })
  @IsString()
  @IsNotEmpty()
  sourceTransactionId: string;

  @ApiProperty({
    description: 'ID del activo que se está conciliando',
    example: '12345678-1234-1234-1234-123456789012',
  })
  @IsString()
  @IsNotEmpty()
  sourceAssetId: string;

  @ApiProperty({
    description: 'Lista de clientes destino y montos a conciliar',
    type: [ReconciliationTargetDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReconciliationTargetDto)
  targets: ReconciliationTargetDto[];

  @ApiProperty({
    description: 'Notas generales sobre la conciliación',
    required: false,
    example: 'Distribución de saldo de Juan Pérez a Maria García',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
