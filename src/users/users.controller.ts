import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { TransformResponseInterceptor } from '../common/interceptor/transform.response.interceptor';
import { ExcludePasswordInterceptor } from '../common/interceptor/exclude-password.interceptor';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { Role } from 'src/common/decorators/role.decorator';
import { UserRole } from '@prisma/client';
import { AuthGuard } from 'src/common/guard/guard.guard';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { RequestWithUser } from 'src/common/interfaces/request-with-user.interface';

@ApiBearerAuth('JWT-auth')
@ApiTags('Users')
@UseGuards(AuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Role(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(ExcludePasswordInterceptor, TransformResponseInterceptor)
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    return user;
  }

  @Get('me')
  @Role(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.VIEWER,
    UserRole.ACCOUNTANT,
  )
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(ExcludePasswordInterceptor, TransformResponseInterceptor)
  @ApiOperation({
    summary: 'Obtener perfil del usuario actual',
    description: 'Obtiene la información del usuario autenticado actualmente',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil del usuario recuperado exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  getProfile(@Req() req: RequestWithUser) {
    return this.usersService.findOne(req.user.sub);
  }

  @Get()
  @Role(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(ExcludePasswordInterceptor, TransformResponseInterceptor)
  findAll(@Query() paginationDto: PaginationDto) {
    return this.usersService.findAll(paginationDto);
  }

  @Get(':id')
  @Role(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(ExcludePasswordInterceptor, TransformResponseInterceptor)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Role(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(ExcludePasswordInterceptor, TransformResponseInterceptor)
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/password')
  @Role(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(ExcludePasswordInterceptor, TransformResponseInterceptor)
  async updatePassword(
    @Param('id') id: string,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ) {
    return this.usersService.updatePassword(id, updatePasswordDto);
  }

  @Patch(':id/disable')
  @Role(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(ExcludePasswordInterceptor, TransformResponseInterceptor)
  disable(@Param('id') id: string) {
    return this.usersService.disable(id);
  }

  @Patch(':id/enable')
  @Role(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(ExcludePasswordInterceptor, TransformResponseInterceptor)
  enable(@Param('id') id: string) {
    return this.usersService.enable(id);
  }

  @Delete(':id')
  @Role(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(ExcludePasswordInterceptor, TransformResponseInterceptor)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
