import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { PaymentResponsibility } from '@prisma/client';

export class CreateLogisticsDto {
  @ApiProperty({
    description: 'ID de la transacción asociada',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  transactionId: string;

  @ApiProperty({
    description: 'Dirección de origen',
    example: 'Av. Córdoba 123, Buenos Aires, Argentina',
  })
  @IsString()
  @IsOptional()
  originAddress?: string;

  @ApiProperty({
    description: 'Dirección de destino',
    example: 'Av. Santa Fe 456, Buenos Aires, Argentina',
  })
  @IsString()
  destinationAddress: string;

  @ApiProperty({
    description: 'Fecha y hora estimada de entrega',
    example: '2023-05-20T14:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @ApiProperty({
    description: 'Notas adicionales',
    example: 'Llamar antes de entregar',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    description: 'Responsabilidad de pago',
    enum: PaymentResponsibility,
    example: 'CLIENT',
  })
  @IsEnum(PaymentResponsibility)
  @IsOptional()
  paymentResponsibility?: PaymentResponsibility;

  @ApiProperty({
    description: 'Estado de la logística',
    example: 'PENDING',
    default: 'PENDING',
  })
  @IsOptional()
  @IsString()
  status?: string;
}
