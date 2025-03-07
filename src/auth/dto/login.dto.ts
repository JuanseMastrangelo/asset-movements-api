import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    example: 'admin',
    description: 'Nombre de usuario',
  })
  username: string;

  @IsNotEmpty()
  @ApiProperty({
    example: 'App123456*',
    description: 'Contraseña del usuario',
  })
  password: string;
}
