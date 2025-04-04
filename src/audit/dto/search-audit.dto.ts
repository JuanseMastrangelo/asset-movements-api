import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsOptional,
  IsString,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchAuditDto {
  @ApiProperty({
    description: 'ID del usuario que realizó la acción',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  changedBy?: string;

  @ApiProperty({
    description: 'Tipo de entidad (User, Asset, Transaction, etc.)',
    required: false,
    example: 'Asset',
  })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiProperty({
    description: 'ID de la entidad',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiProperty({
    description: 'Acción realizada (create, update, delete)',
    required: false,
    example: 'create',
  })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiProperty({
    description: 'Fecha de inicio (formato ISO8601)',
    required: false,
    example: '2023-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'Fecha de fin (formato ISO8601)',
    required: false,
    example: '2023-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'Número de página',
    required: false,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @ApiProperty({
    description: 'Número de elementos por página',
    required: false,
    default: 10,
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  limit?: number;
}
