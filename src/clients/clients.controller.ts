import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { TransformResponseInterceptor } from 'src/common/interceptor/transform.response.interceptor';
import { Role } from 'src/common/decorators/role.decorator';
import { UserRole } from '@prisma/client';
import { AuthGuard } from 'src/common/guard/guard.guard';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { SearchClientsDto } from './dto/search-clients.dto';

@ApiBearerAuth('JWT-auth')
@ApiTags('Clients')
@UseGuards(AuthGuard)
@UseInterceptors(TransformResponseInterceptor)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @Role(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear un nuevo cliente' })
  @ApiResponse({ status: 201, description: 'Cliente creado exitosamente' })
  create(@Body() createClientDto: CreateClientDto) {
    return this.clientsService.create(createClientDto);
  }

  @Get()
  @Role(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar todos los clientes' })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes recuperada exitosamente',
  })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.clientsService.findAll(paginationDto);
  }

  @Get('search')
  @Role(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buscar clientes con filtros' })
  @ApiResponse({ status: 200, description: 'Resultados de la búsqueda' })
  search(@Query() searchDto: SearchClientsDto) {
    return this.clientsService.search(searchDto);
  }

  @Get(':id')
  @Role(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener un cliente por ID' })
  @ApiResponse({ status: 200, description: 'Cliente encontrado' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  @Role(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar un cliente' })
  @ApiResponse({ status: 200, description: 'Cliente actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto) {
    return this.clientsService.update(id, updateClientDto);
  }

  @Patch(':id/disable')
  @Role(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desactivar un cliente' })
  @ApiResponse({ status: 200, description: 'Cliente desactivado exitosamente' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  disable(@Param('id') id: string) {
    return this.clientsService.disable(id);
  }

  @Patch(':id/enable')
  @Role(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activar un cliente' })
  @ApiResponse({ status: 200, description: 'Cliente activado exitosamente' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  enable(@Param('id') id: string) {
    return this.clientsService.enable(id);
  }

  @Delete(':id')
  @Role(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar un cliente' })
  @ApiResponse({ status: 200, description: 'Cliente eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }
}
