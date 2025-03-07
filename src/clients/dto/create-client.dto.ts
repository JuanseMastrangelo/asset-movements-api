import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateClientDto {
  @IsNotEmpty({ message: 'El nombre del cliente es requerido' })
  @MaxLength(50, {
    message: 'El nombre del cliente debe tener menos de 50 caracteres',
  })
  @IsString({ message: 'El nombre del cliente debe ser una cadena de texto' })
  name: string;

  @IsNotEmpty({ message: 'El correo electrónico del cliente es requerido' })
  @MaxLength(100, {
    message:
      'El correo electrónico del cliente debe tener menos de 100 caracteres',
  })
  @IsEmail(
    {},
    {
      message:
        'El correo electrónico del cliente debe ser una dirección de correo válida',
    },
  )
  @IsString({
    message: 'El correo electrónico del cliente debe ser una cadena de texto',
  })
  email: string;

  @IsNotEmpty({ message: 'El teléfono del cliente es requerido' })
  @MaxLength(20, {
    message: 'El teléfono del cliente debe tener menos de 10 caracteres',
  })
  @IsString({ message: 'El teléfono del cliente debe ser una cadena de texto' })
  phone: string;

  @IsNotEmpty({ message: 'La dirección del cliente es requerida' })
  @MaxLength(100, {
    message: 'La dirección del cliente debe tener menos de 100 caracteres',
  })
  @IsString({
    message: 'La dirección del cliente debe ser una cadena de texto',
  })
  address: string;

  @IsNotEmpty({ message: 'El país del cliente es requerido' })
  @MaxLength(50, {
    message: 'El país del cliente debe tener menos de 50 caracteres',
  })
  @IsString({ message: 'El país del cliente debe ser una cadena de texto' })
  country: string;
}
