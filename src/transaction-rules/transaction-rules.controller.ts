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
import { TransactionRulesService } from './transaction-rules.service';
import { CreateTransactionRuleDto } from './dto/create-transaction-rule.dto';
import { UpdateTransactionRuleDto } from './dto/update-transaction-rule.dto';
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

@ApiTags('Transaction Rules')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard)
@UseInterceptors(TransformResponseInterceptor)
@Controller('transaction-rules')
export class TransactionRulesController {
  constructor(
    private readonly transactionRulesService: TransactionRulesService,
  ) {}

  @Post()
  @Role(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Crear una nueva regla de conversión entre activos',
  })
  @ApiResponse({
    status: 201,
    description: 'La regla ha sido creada exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Petición inválida' })
  @ApiResponse({ status: 404, description: 'Activo no encontrado' })
  @ApiResponse({ status: 409, description: 'La regla ya existe' })
  async create(@Body() createTransactionRuleDto: CreateTransactionRuleDto) {
    return await this.transactionRulesService.create(createTransactionRuleDto);
  }

  @Get()
  @Role(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Obtener todas las reglas de conversión' })
  @ApiResponse({
    status: 200,
    description: 'Lista de reglas de conversión',
  })
  async findAll() {
    return await this.transactionRulesService.findAll();
  }

  @Get('asset/:id')
  @Role(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Obtener todas las reglas relacionadas con un activo específico',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de reglas de conversión para el activo',
  })
  async findAllForAsset(@Param('id') id: string) {
    return await this.transactionRulesService.findAllForAsset(id);
  }

  @Get(':id')
  @Role(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Obtener una regla de conversión por ID' })
  @ApiResponse({
    status: 200,
    description: 'Regla de conversión encontrada',
  })
  @ApiResponse({ status: 404, description: 'Regla no encontrada' })
  async findOne(@Param('id') id: string) {
    return await this.transactionRulesService.findOne(id);
  }

  @Patch(':id')
  @Role(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Actualizar una regla de conversión' })
  @ApiResponse({
    status: 200,
    description: 'La regla ha sido actualizada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Regla no encontrada' })
  async update(
    @Param('id') id: string,
    @Body() updateTransactionRuleDto: UpdateTransactionRuleDto,
  ) {
    return await this.transactionRulesService.update(
      id,
      updateTransactionRuleDto,
    );
  }

  @Delete(':id')
  @Role(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Eliminar una regla de conversión' })
  @ApiResponse({
    status: 200,
    description: 'La regla ha sido eliminada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Regla no encontrada' })
  async remove(@Param('id') id: string) {
    return await this.transactionRulesService.remove(id);
  }

  @Patch(':id/enable')
  @Role(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Habilitar una regla de conversión' })
  @ApiResponse({
    status: 200,
    description: 'La regla ha sido habilitada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Regla no encontrada' })
  async enable(@Param('id') id: string) {
    return await this.transactionRulesService.enable(id);
  }

  @Patch(':id/disable')
  @Role(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Deshabilitar una regla de conversión' })
  @ApiResponse({
    status: 200,
    description: 'La regla ha sido deshabilitada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Regla no encontrada' })
  async disable(@Param('id') id: string) {
    return await this.transactionRulesService.disable(id);
  }

  @Get('validate/:sourceAssetId/:targetAssetId')
  @Role(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Verificar si es posible convertir entre dos activos',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado de la validación',
  })
  async canConvert(
    @Param('sourceAssetId') sourceAssetId: string,
    @Param('targetAssetId') targetAssetId: string,
  ) {
    const isValid = await this.transactionRulesService.canConvert(
      sourceAssetId,
      targetAssetId,
    );
    return { isValid };
  }
}
