import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { SearchAuditDto } from './dto/search-audit.dto';
import { AuthGuard } from '../common/guard/guard.guard';
import { Role } from '../common/decorators/role.decorator';
import { UserRole } from '@prisma/client';
import { TransformResponseInterceptor } from '../common/interceptor/transform.response.interceptor';

@ApiTags('Audit')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard)
@UseInterceptors(TransformResponseInterceptor)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Role(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Obtener registros de auditoría' })
  @ApiResponse({
    status: 200,
    description: 'Lista de registros de auditoría recuperados exitosamente',
  })
  findAll(@Query() searchDto: SearchAuditDto) {
    return this.auditService.findAll(searchDto);
  }

  @Get('roles')
  @Role(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Obtener lista de roles para filtrado' })
  @ApiResponse({
    status: 200,
    description: 'Lista de roles recuperada exitosamente',
  })
  getRoles() {
    return this.auditService.getRoles();
  }
}
