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
} from '@nestjs/common';
import { LogisticsService } from './logistics.service';
import {
  CreateLogisticsDto,
  UpdateLogisticsDto,
  CreateLogisticsSettingsDto,
  UpdateLogisticsSettingsDto,
  CalculateLogisticsPriceDto,
} from './dto';
import { AuthGuard } from '../common/guard/guard.guard';
import { Role } from '../common/decorators/role.decorator';
import { UserRole } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TransformResponseInterceptor } from 'src/common/interceptor/transform.response.interceptor';

@ApiTags('Logistics')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard)
@UseInterceptors(TransformResponseInterceptor)
@Controller('logistics')
export class LogisticsController {
  constructor(private readonly logisticsService: LogisticsService) {}

  // Endpoints para logística
  @Post()
  @Role(
    UserRole.OPERATOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.LOGISTICS_MANAGER,
  )
  @ApiOperation({ summary: 'Crear una nueva logística para una transacción' })
  @ApiResponse({
    status: 201,
    description: 'La logística ha sido creada exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Petición inválida' })
  @ApiResponse({ status: 404, description: 'Transacción no encontrada' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe una logística para esta transacción',
  })
  async create(@Body() createLogisticsDto: CreateLogisticsDto) {
    return await this.logisticsService.createLogistics(createLogisticsDto);
  }

  @Get()
  @Role(
    UserRole.OPERATOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.LOGISTICS_MANAGER,
  )
  @ApiOperation({ summary: 'Obtener todas las logísticas' })
  @ApiResponse({
    status: 200,
    description: 'Lista de logísticas',
  })
  async findAll() {
    return await this.logisticsService.findAllLogistics();
  }

  @Get('settings')
  @Role(
    UserRole.OPERATOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.LOGISTICS_MANAGER,
  )
  @ApiOperation({ summary: 'Obtener todas las configuraciones de precios' })
  @ApiResponse({
    status: 200,
    description: 'Lista de configuraciones',
  })
  async findAllSettings() {
    return await this.logisticsService.findAllLogisticsSettings();
  }

  @Get('settings/active')
  @Role(
    UserRole.OPERATOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.LOGISTICS_MANAGER,
  )
  @ApiOperation({ summary: 'Obtener la configuración de precios activa' })
  @ApiResponse({
    status: 200,
    description: 'Configuración activa',
  })
  @ApiResponse({ status: 404, description: 'No hay configuración activa' })
  async findActiveSettings() {
    return await this.logisticsService.findActiveLogisticsSettings();
  }

  @Get('settings/:id')
  @Role(
    UserRole.OPERATOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.LOGISTICS_MANAGER,
  )
  @ApiOperation({ summary: 'Obtener una configuración de precios por ID' })
  @ApiResponse({
    status: 200,
    description: 'Configuración encontrada',
  })
  @ApiResponse({ status: 404, description: 'Configuración no encontrada' })
  async findOneSettings(@Param('id') id: string) {
    return await this.logisticsService.findLogisticsSettingsById(id);
  }

  @Patch('settings/:id')
  @Role(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Actualizar una configuración de precios' })
  @ApiResponse({
    status: 200,
    description: 'Configuración actualizada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Configuración no encontrada' })
  async updateSettings(
    @Param('id') id: string,
    @Body() updateLogisticsSettingsDto: UpdateLogisticsSettingsDto,
  ) {
    return await this.logisticsService.updateLogisticsSettings(
      id,
      updateLogisticsSettingsDto,
    );
  }

  @Delete('settings/:id')
  @Role(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Eliminar una configuración de precios' })
  @ApiResponse({
    status: 200,
    description: 'Configuración eliminada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Configuración no encontrada' })
  async removeSettings(@Param('id') id: string) {
    await this.logisticsService.removeLogisticsSettings(id);
    return { message: 'Configuración eliminada correctamente' };
  }

  @Get('transaction/:id')
  @Role(
    UserRole.OPERATOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.LOGISTICS_MANAGER,
  )
  @ApiOperation({
    summary: 'Obtener la logística para una transacción específica',
  })
  @ApiResponse({
    status: 200,
    description: 'Logística encontrada',
  })
  @ApiResponse({ status: 404, description: 'Logística no encontrada' })
  async findByTransactionId(@Param('id') id: string) {
    return await this.logisticsService.findLogisticsByTransactionId(id);
  }

  @Get(':id')
  @Role(
    UserRole.OPERATOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.LOGISTICS_MANAGER,
  )
  @ApiOperation({ summary: 'Obtener una logística por ID' })
  @ApiResponse({
    status: 200,
    description: 'Logística encontrada',
  })
  @ApiResponse({ status: 404, description: 'Logística no encontrada' })
  async findOne(@Param('id') id: string) {
    return await this.logisticsService.findLogisticsById(id);
  }

  @Patch(':id')
  @Role(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.LOGISTICS_MANAGER)
  @ApiOperation({ summary: 'Actualizar una logística' })
  @ApiResponse({
    status: 200,
    description: 'La logística ha sido actualizada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Logística no encontrada' })
  async update(
    @Param('id') id: string,
    @Body() updateLogisticsDto: UpdateLogisticsDto,
  ) {
    return await this.logisticsService.updateLogistics(id, updateLogisticsDto);
  }

  @Delete(':id')
  @Role(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Eliminar una logística' })
  @ApiResponse({
    status: 200,
    description: 'La logística ha sido eliminada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Logística no encontrada' })
  async remove(@Param('id') id: string) {
    await this.logisticsService.removeLogistics(id);
    return { message: 'Logística eliminada correctamente' };
  }

  // Endpoints para cálculo de precios
  @Post('calculate')
  @Role(
    UserRole.OPERATOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.LOGISTICS_MANAGER,
  )
  @ApiOperation({ summary: 'Calcular el precio de una logística' })
  @ApiResponse({
    status: 200,
    description: 'Precio calculado exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Error en el cálculo' })
  async calculatePrice(
    @Body() calculateLogisticsPriceDto: CalculateLogisticsPriceDto,
  ) {
    return await this.logisticsService.calculatePrice(
      calculateLogisticsPriceDto,
    );
  }

  // Endpoints para configuraciones
  @Post('settings')
  @Role(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Crear una nueva configuración de precios para logística',
  })
  @ApiResponse({
    status: 201,
    description: 'Configuración creada exitosamente',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe una configuración con ese nombre',
  })
  async createSettings(
    @Body() createLogisticsSettingsDto: CreateLogisticsSettingsDto,
  ) {
    return await this.logisticsService.createLogisticsSettings(
      createLogisticsSettingsDto,
    );
  }
}
