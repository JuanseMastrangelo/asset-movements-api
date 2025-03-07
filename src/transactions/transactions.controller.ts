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
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.transactionsService.findAll(page, limit);
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
    return this.transactionsService.search(searchDto);
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
  @ApiOperation({ summary: 'Actualizar una transacción' })
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
  @ApiOperation({ summary: 'Actualizar el estado de una transacción' })
  @ApiParam({ name: 'id', description: 'ID de la transacción' })
  @ApiResponse({
    status: 200,
    description: 'Estado de transacción actualizado',
  })
  @ApiResponse({
    status: 400,
    description: 'Estado inválido o la transacción ya está en ese estado',
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
    summary: 'Crear una transacción hija vinculada a una transacción padre',
  })
  @ApiParam({ name: 'parentId', description: 'ID de la transacción padre' })
  @ApiResponse({
    status: 201,
    description: 'Transacción hija creada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos en la solicitud',
  })
  @ApiResponse({
    status: 404,
    description: 'Transacción padre no encontrada',
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
}
