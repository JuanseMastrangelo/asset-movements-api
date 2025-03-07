import { UserRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsStrongPassword,
  MaxLength,
  IsOptional,
} from 'class-validator';
import { Exclude } from 'src/common/decorators/exclude-property.decorator';

export class CreateUserDto {
  @IsNotEmpty({ message: 'El nombre de usuario es requerido' })
  @MaxLength(50, {
    message: 'El nombre de usuario debe tener menos de 50 caracteres',
  })
  username: string;

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

  @IsOptional()
  @IsEnum(UserRole, { message: 'El rol debe ser un valor válido' })
  role?: UserRole;
}
