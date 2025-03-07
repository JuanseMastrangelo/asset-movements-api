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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiBearerAuth('JWT-auth')
@ApiTags('Clients')
@Role(UserRole.SUPER_ADMIN, UserRole.ADMIN)
@UseGuards(AuthGuard)
@UseInterceptors(TransformResponseInterceptor)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createClientDto: CreateClientDto) {
    return this.clientsService.create(createClientDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(@Query() paginationDto: PaginationDto) {
    return this.clientsService.findAll(paginationDto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto) {
    return this.clientsService.update(id, updateClientDto);
  }

  @Patch(':id/disable')
  @HttpCode(HttpStatus.OK)
  disable(@Param('id') id: string) {
    return this.clientsService.disable(id);
  }

  @Patch(':id/enable')
  @HttpCode(HttpStatus.OK)
  enable(@Param('id') id: string) {
    return this.clientsService.enable(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }
}
