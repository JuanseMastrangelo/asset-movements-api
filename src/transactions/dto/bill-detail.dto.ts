import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsInt, Min, IsOptional, IsDateString } from 'class-validator';

export class BillDetailDto {
  @ApiProperty({
    description: 'ID de la denominación',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  denominationId: string;

  @ApiProperty({
    description: 'Cantidad de billetes de esta denominación',
    example: 3,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Fecha de recepción de los billetes',
    required: false,
    example: '2023-01-01T12:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  receivedDate?: string;
}
