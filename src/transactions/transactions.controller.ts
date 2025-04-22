import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  UseInterceptors,
  HttpException,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { AuthGuard } from 'src/common/guard/guard.guard';
import { Role } from 'src/common/decorators/role.decorator';
import { UserRole } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { RequestWithUser } from '../common/interfaces/request-with-user.interface';
import { UpdateTransactionStateDto } from './dto/update-transaction-state.dto';
import { SearchTransactionsDto } from './dto/search-transactions.dto';
import { TransformResponseInterceptor } from '../common/interceptor/transform.response.interceptor';
import { CreatePartialTransactionDto } from './dto/create-partial-transaction.dto';
import { CompletePendingTransactionDto } from './dto/complete-pending-transaction.dto';
import { CreateReconciliationDto } from './dto/create-reconciliation.dto';
import { FindClientsForReconciliationDto } from './dto/find-clients-for-reconciliation.dto';
import { ConciliateImmutableAssetsDto } from './dto/conciliate-immutable-assets.dto';

@ApiTags('Transactions')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard)
@UseInterceptors(TransformResponseInterceptor)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @Role(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una nueva transacción' })
  @ApiResponse({
    status: 201,
    description: 'Transacción creada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos en la solicitud',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente no encontrado',
  })
  async create(
    @Body() createTransactionDto: CreateTransactionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.transactionsService.create(createTransactionDto, req.user.sub);
  }

  @Get()
  @Role(
    UserRole.OPERATOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  @ApiOperation({ summary: 'Listar todas las transacciones' })
  @ApiResponse({
    status: 200,
    description: 'Lista de transacciones',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número de página',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Elementos por página',
  })
  @ApiQuery({
    name: 'includeCancelled',
    required: false,
    type: Boolean,
    description: 'Incluir transacciones canceladas (por defecto: false)',
  })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('includeCancelled', new DefaultValuePipe(false))
    includeCancelled: boolean,
  ) {
    try {
      return this.transactionsService.findAll(page, limit, includeCancelled);
    } catch (error) {
      console.error('Error en findAll:', error);
      throw new HttpException(
        'Error al listar transacciones: ' + error.message,
        (error.status || HttpStatus.INTERNAL_SERVER_ERROR) as number,
      );
    }
  }

  @Get('immutable-assets-open')
  @Role(
    UserRole.OPERATOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  @ApiOperation({
    summary:
      'Obtener todas las transacciones abiertas de cable traer, cable llevar y cuentas madres',
    description:
      'Devuelve todas las transacciones abiertas relacionadas con activos inmutables y cuentas madres sin paginación',
  })
  @ApiResponse({
    status: 200,
    description:
      'Lista de transacciones abiertas de activos inmutables y cuentas madres',
  })
  findOpenImmutableAssetTransactions() {
    try {
      return this.transactionsService.findOpenImmutableAssetTransactions();
    } catch (error) {
      console.error('Error en findOpenImmutableAssetTransactions:', error);
      throw new HttpException(
        'Error al obtener transacciones de activos inmutables: ' +
          error.message,
        (error.status || HttpStatus.INTERNAL_SERVER_ERROR) as number,
      );
    }
  }

  @Get('search')
  @Role(
    UserRole.OPERATOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  @ApiOperation({ summary: 'Buscar transacciones con filtros' })
  @ApiResponse({
    status: 200,
    description: 'Resultados de la búsqueda',
  })
  async search(@Query() searchDto: SearchTransactionsDto) {
    try {
      return await this.transactionsService.search(searchDto);
    } catch (error) {
      console.error('Error en search:', error);
      throw new HttpException(
        'Error al buscar transacciones: ' + error.message,
        (error.status || HttpStatus.INTERNAL_SERVER_ERROR) as number,
      );
    }
  }

  @Get(':id')
  @Role(
    UserRole.OPERATOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  @ApiOperation({ summary: 'Obtener una transacción por ID' })
  @ApiParam({ name: 'id', description: 'ID de la transacción' })
  @ApiResponse({
    status: 200,
    description: 'Transacción encontrada',
  })
  @ApiResponse({
    status: 404,
    description: 'Transacción no encontrada',
  })
  findOne(@Param('id') id: string) {
    return this.transactionsService.findOne(id);
  }

  @Patch(':id')
  @Role(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Actualizar una transacción',
    description:
      'Permite actualizar datos básicos, detalles y billetes de una transacción. También soporta completar parcialmente la transacción, creando automáticamente una transacción pendiente para el saldo restante.',
  })
  @ApiParam({ name: 'id', description: 'ID de la transacción' })
  @ApiResponse({
    status: 200,
    description: 'Transacción actualizada',
  })
  @ApiResponse({
    status: 404,
    description: 'Transacción no encontrada',
  })
  @ApiResponse({
    status: 409,
    description: 'No se puede modificar una transacción completada',
  })
  update(
    @Param('id') id: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.transactionsService.update(
      id,
      updateTransactionDto,
      req.user.sub,
    );
  }

  @Patch(':id/state')
  @Role(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Actualizar el estado de una transacción',
    description:
      'Cambia el estado de una transacción. Si se cambia a CURRENT_ACCOUNT o COMPLETED, se actualizan los balances del cliente.',
  })
  @ApiParam({ name: 'id', description: 'ID de la transacción' })
  @ApiResponse({
    status: 200,
    description: 'Estado de transacción actualizado',
  })
  @ApiResponse({
    status: 404,
    description: 'Transacción no encontrada',
  })
  @ApiResponse({
    status: 409,
    description: 'No se puede cambiar el estado de una transacción completada',
  })
  updateState(
    @Param('id') id: string,
    @Body() updateStateDto: UpdateTransactionStateDto,
    @Req() req: RequestWithUser,
  ) {
    return this.transactionsService.updateState(
      id,
      updateStateDto,
      req.user.sub,
    );
  }

  @Delete(':id')
  @Role(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Eliminar una transacción' })
  @ApiParam({ name: 'id', description: 'ID de la transacción' })
  @ApiResponse({
    status: 200,
    description: 'Transacción eliminada',
  })
  @ApiResponse({
    status: 404,
    description: 'Transacción no encontrada',
  })
  @ApiResponse({
    status: 409,
    description:
      'No se puede eliminar una transacción completada o con transacciones hijas',
  })
  remove(@Param('id') id: string) {
    return this.transactionsService.remove(id);
  }

  @Post(':parentId/child')
  @Role(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear una transacción hija',
    description:
      'Crea una transacción hija que está vinculada a una transacción padre. Las transacciones hijas ayudan a completar la cantidad total de la transacción padre. Si las transacciones hijas cubren el monto completo de la padre, esta se marca como completada automáticamente.',
  })
  @ApiParam({ name: 'parentId', description: 'ID de la transacción padre' })
  @ApiResponse({
    status: 201,
    description: 'Transacción hija creada exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Transacción padre no encontrada',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos en la solicitud',
  })
  createChildTransaction(
    @Param('parentId') parentId: string,
    @Body() createTransactionDto: CreateTransactionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.transactionsService.createChildTransaction(
      parentId,
      createTransactionDto,
      req.user.sub,
    );
  }

  @Post('partial')
  @Role(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una transacción parcial' })
  @ApiResponse({
    status: 201,
    description: 'Transacción parcial creada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos en la solicitud',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente no encontrado',
  })
  createPartialTransaction(
    @Body() createPartialTransactionDto: CreatePartialTransactionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.transactionsService.createPartialTransaction(
      createPartialTransactionDto,
      req.user.sub,
    );
  }

  @Post(':id/complete')
  @Role(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Completar una transacción pendiente' })
  @ApiParam({ name: 'id', description: 'ID de la transacción pendiente' })
  @ApiResponse({
    status: 200,
    description: 'Transacción completada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'La transacción no está en estado pendiente',
  })
  @ApiResponse({
    status: 404,
    description: 'Transacción no encontrada',
  })
  completePendingTransaction(
    @Param('id') id: string,
    @Body() completePendingTransactionDto: CompletePendingTransactionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.transactionsService.completePendingTransaction(
      id,
      completePendingTransactionDto,
      req.user.sub,
    );
  }

  @Patch(':id/cancel')
  @Role(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Cancelar una transacción' })
  @ApiParam({ name: 'id', description: 'ID de la transacción' })
  @ApiResponse({
    status: 200,
    description: 'Transacción cancelada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Solo se pueden cancelar transacciones en estado PENDING',
  })
  @ApiResponse({
    status: 404,
    description: 'Transacción no encontrada',
  })
  cancel(@Param('id') id: string, @Req() req: RequestWithUser) {
    try {
      return this.transactionsService.cancel(id, req.user.sub);
    } catch (error) {
      console.error('Error en cancel:', error);
      throw new HttpException(
        'Error al cancelar la transacción: ' + error.message,
        (error.status || HttpStatus.INTERNAL_SERVER_ERROR) as number,
      );
    }
  }

  @Post('reconcile')
  @Role(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Conciliar saldos entre clientes',
    description:
      'Toma un saldo positivo de un cliente y lo distribuye para saldar deudas con otros clientes que tienen saldo negativo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Conciliación realizada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o saldo insuficiente',
  })
  reconcile(
    @Body() createReconciliationDto: CreateReconciliationDto,
    @Req() req: RequestWithUser,
  ) {
    return this.transactionsService.reconcile(
      createReconciliationDto,
      req.user.sub,
    );
  }

  @Post('find-clients-for-reconciliation')
  @Role(
    UserRole.OPERATOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Buscar clientes disponibles para conciliación',
    description:
      'Encuentra clientes con balances positivos (que deben dinero) y negativos (a los que se les debe) para un activo específico.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes con balances disponibles para conciliación',
  })
  findClientsForReconciliation(
    @Body() findClientsDto: FindClientsForReconciliationDto,
  ) {
    return this.transactionsService.findClientsForReconciliation(
      findClientsDto,
    );
  }

  @Post('conciliate-immutable-assets')
  @Role(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Registrar pase de mano con activos inmutables',
    description:
      'Registra operaciones con activos inmutables como "Cable traer" y "Cable llevar" entre diversos clientes sin afectar saldos, solo para trazabilidad.',
  })
  @ApiResponse({
    status: 200,
    description: 'Operación registrada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o errores en la operación',
  })
  conciliateImmutableAssets(
    @Body() conciliateImmutableAssetsDto: ConciliateImmutableAssetsDto,
    @Req() req: RequestWithUser,
  ) {
    return this.transactionsService.conciliateImmutableAssets(
      conciliateImmutableAssetsDto,
      req.user.sub,
    );
  }
}
