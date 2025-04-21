import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class UpdateSystemBalanceDto {
  @IsNotEmpty({ message: 'El ID del activo es requerido' })
  @IsString({ message: 'El ID del activo debe ser una cadena de caracteres' })
  assetId: string;

  @IsNotEmpty({ message: 'El balance es requerido' })
  @IsNumber({}, { message: 'El balance debe ser un número' })
  balance: number;
}
