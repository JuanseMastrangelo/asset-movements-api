import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchClientsDto {
  @ApiProperty({
    description: 'Nombre del cliente (búsqueda parcial)',
    required: false,
    example: 'Juan',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Email del cliente (búsqueda parcial)',
    required: false,
    example: 'cliente@example.com',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({
    description: 'Teléfono del cliente (búsqueda parcial)',
    required: false,
    example: '123456789',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'País del cliente',
    required: false,
    example: 'México',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({
    description: 'Estado activo/inactivo del cliente',
    required: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiProperty({
    description: 'Fecha de creación desde (formato ISO8601)',
    required: false,
    example: '2023-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiProperty({
    description: 'Fecha de creación hasta (formato ISO8601)',
    required: false,
    example: '2023-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiProperty({
    description: 'Dirección del cliente (búsqueda parcial)',
    required: false,
    example: 'Calle Principal',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    description: 'Número máximo de resultados',
    required: false,
    default: 10,
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  limit?: number;

  @ApiProperty({
    description: 'Desplazamiento para paginación',
    required: false,
    default: 0,
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  offset?: number;
}
