import {
  IsEmail,
  IsNotEmpty,
  IsStrongPassword,
  MaxLength,
} from 'class-validator';
import { Exclude } from 'src/common/decorators/exclude-property.decorator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'Nombre de usuario para iniciar sesión',
    example: 'usuario123',
  })
  @IsNotEmpty({ message: 'El nombre de usuario es requerido' })
  @MaxLength(50, {
    message: 'El nombre de usuario debe tener menos de 50 caracteres',
  })
  username: string;

  @ApiProperty({
    description: 'Correo electrónico del usuario',
    example: 'usuario@example.com',
  })
  @IsNotEmpty({ message: 'El correo electrónico es requerido' })
  @MaxLength(100, {
    message: 'El correo electrónico debe tener menos de 100 caracteres',
  })
  @IsEmail(
    {},
    {
      message: 'El correo electrónico debe ser una dirección de correo válida',
    },
  )
  email: string;

  @ApiProperty({
    description:
      'Contraseña del usuario (mínimo 8 caracteres, incluir mayúsculas, minúsculas, números y símbolos)',
    example: 'P@ssw0rd123!',
  })
  @Exclude()
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    {
      message:
        'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo',
    },
  )
  @MaxLength(100, {
    message: 'La contraseña debe tener menos de 100 caracteres',
  })
  password: string;
}
