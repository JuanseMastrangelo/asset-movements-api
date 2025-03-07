import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
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

@ApiTags('Dashboard')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard)
@UseInterceptors(TransformResponseInterceptor)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stock')
  @Role(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Obtener el stock total de activos en el sistema' })
  @ApiResponse({
    status: 200,
    description: 'Lista de activos con sus cantidades',
  })
  async getTotalStock() {
    return await this.dashboardService.getTotalStock();
  }

  @Get('current-accounts')
  @Role(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Obtener el total de las cuentas corrientes de clientes por activo',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de activos con el total de balances de clientes',
  })
  async getTotalCurrentAccounts() {
    return await this.dashboardService.getTotalCurrentAccounts();
  }

  @Get('pending-tasks')
  @Role(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Obtener la lista de transacciones pendientes agrupadas por cliente',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de tareas pendientes con totales por activo',
  })
  async getPendingTasks() {
    return await this.dashboardService.getPendingTasks();
  }

  @Get('client-current-accounts')
  @Role(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Obtener la lista de balances de clientes por cliente y activo',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes con sus balances por activo',
  })
  async getClientCurrentAccounts() {
    return await this.dashboardService.getClientCurrentAccounts();
  }

  @Get('transaction-history')
  @Role(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Obtener el historial de transacciones recientes' })
  @ApiResponse({
    status: 200,
    description: 'Lista de transacciones recientes',
  })
  async getTransactionHistory() {
    return await this.dashboardService.getTransactionHistory(20);
  }

  @Get('system-balance')
  @Role(
    UserRole.OPERATOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  @ApiOperation({ summary: 'Obtener el balance del sistema' })
  @ApiResponse({
    status: 200,
    description: 'Balance del sistema agrupado por activo',
  })
  async getSystemBalance() {
    return await this.dashboardService.getSystemBalance();
  }
}
