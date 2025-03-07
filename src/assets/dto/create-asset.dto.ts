import { AssetType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAssetDto {
  @IsNotEmpty({ message: 'El nombre del activo es requerido' })
  @MaxLength(100, {
    message: 'El nombre del activo debe tener menos de 100 caracteres',
  })
  @IsString({
    message: 'El nombre del activo debe ser una cadena de caracteres',
  })
  name: string;

  @IsNotEmpty({ message: 'La descripción del activo es requerida' })
  @MaxLength(255, {
    message: 'La descripción del activo debe tener menos de 255 caracteres',
  })
  @IsString({
    message: 'La descripción del activo debe ser una cadena de caracteres',
  })
  description: string;

  @IsNotEmpty({ message: 'El tipo de activo es requerido' })
  @IsEnum(AssetType, { message: 'El tipo de activo debe ser un valor válido' })
  type: AssetType;

  @IsOptional()
  @IsBoolean({ message: 'El porcentaje debe ser un valor booleano' })
  isPercentage: boolean;

  @IsOptional()
  @IsBoolean({ message: 'La cuenta madre debe ser un valor booleano' })
  isMtherAccount: boolean;
}
