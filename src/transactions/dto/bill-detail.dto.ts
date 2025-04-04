import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsInt, Min } from 'class-validator';

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
}
