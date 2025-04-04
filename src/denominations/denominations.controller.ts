import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { DenominationsService } from './denominations.service';
import { CreateDenominationDto } from './dto/create-denomination.dto';
import { UpdateDenominationDto } from './dto/update-denomination.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '../common/guard/guard.guard';
import { Role } from '../common/decorators/role.decorator';
import { UserRole } from '@prisma/client';
import { TransformResponseInterceptor } from '../common/interceptor/transform.response.interceptor';

@ApiTags('Denominations')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard)
@UseInterceptors(TransformResponseInterceptor)
@Controller('denominations')
export class DenominationsController {
  constructor(private readonly denominationsService: DenominationsService) {}

  @Post()
  @Role(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Crear una nueva denominación' })
  @ApiResponse({
    status: 201,
    description: 'Denominación creada exitosamente',
  })
  create(@Body() createDenominationDto: CreateDenominationDto) {
    return this.denominationsService.create(createDenominationDto);
  }

  @Get()
  @Role(
    UserRole.OPERATOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.ACCOUNTANT,
  )
  @ApiOperation({
    summary: 'Listar todas las denominaciones o filtrar por activo',
  })
  @ApiQuery({
    name: 'assetId',
    required: false,
    description: 'ID del activo para filtrar',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de denominaciones',
  })
  findAll(@Query('assetId') assetId?: string) {
    return this.denominationsService.findAll(assetId);
  }

  @Get(':id')
  @Role(
    UserRole.OPERATOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.ACCOUNTANT,
  )
  @ApiOperation({ summary: 'Obtener una denominación por ID' })
  @ApiResponse({
    status: 200,
    description: 'Denominación encontrada',
  })
  @ApiResponse({
    status: 404,
    description: 'Denominación no encontrada',
  })
  findOne(@Param('id') id: string) {
    return this.denominationsService.findOne(id);
  }

  @Patch(':id')
  @Role(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Actualizar una denominación' })
  @ApiResponse({
    status: 200,
    description: 'Denominación actualizada exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Denominación no encontrada',
  })
  update(
    @Param('id') id: string,
    @Body() updateDenominationDto: UpdateDenominationDto,
  ) {
    return this.denominationsService.update(id, updateDenominationDto);
  }

  @Delete(':id')
  @Role(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Eliminar una denominación' })
  @ApiResponse({
    status: 200,
    description: 'Denominación eliminada exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Denominación no encontrada',
  })
  @ApiResponse({
    status: 409,
    description: 'No se puede eliminar porque está siendo utilizada',
  })
  remove(@Param('id') id: string) {
    return this.denominationsService.remove(id);
  }

  @Get('asset/:assetId')
  @Role(
    UserRole.OPERATOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.ACCOUNTANT,
  )
  @ApiOperation({ summary: 'Obtener denominaciones activas por ID de activo' })
  @ApiResponse({
    status: 200,
    description: 'Lista de denominaciones para el activo',
  })
  findByAssetId(@Param('assetId') assetId: string) {
    return this.denominationsService.findByAssetId(assetId);
  }
}
