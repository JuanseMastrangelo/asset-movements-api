import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { TransformResponseInterceptor } from 'src/common/interceptor/transform.response.interceptor';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { AssetType, UserRole } from '@prisma/client';
import { UpdateSystemBalanceDto } from './dto/update-system-balance.dto';
import { BulkUpdateSystemBalanceDto } from './dto/bulk-update-system-balance.dto';
import { AuthGuard } from 'src/common/guard/guard.guard';
import { Role } from 'src/common/decorators/role.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('Assets')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard)
@UseInterceptors(TransformResponseInterceptor)
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  async create(@Body() createAssetDto: CreateAssetDto) {
    const asset = await this.assetsService.create(createAssetDto);

    return asset;
  }

  @Get()
  findAll(@Query() paginationDto: PaginationDto) {
    // Para obtener todos los assets, usar limit=-1
    const assets = this.assetsService.findAll(paginationDto);

    return assets;
  }

  @Get('type')
  async findAllType(@Query('type') type: AssetType) {
    const assets = await this.assetsService.findAllType(type);

    return assets;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const asset = await this.assetsService.findOne(id);

    return asset;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateAssetDto: UpdateAssetDto,
  ) {
    const asset = await this.assetsService.update(id, updateAssetDto);

    return asset;
  }

  @Patch(':id/enable')
  async enable(@Param('id') id: string) {
    const asset = await this.assetsService.enable(id);

    return asset;
  }

  @Patch(':id/disable')
  async disable(@Param('id') id: string) {
    const asset = await this.assetsService.disable(id);

    return asset;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const asset = await this.assetsService.remove(id);

    return asset;
  }

  @Get('system/balances')
  @Role(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  @ApiOperation({ summary: 'Obtener los balances del sistema' })
  @ApiResponse({
    status: 200,
    description: 'Balances del sistema recuperados exitosamente',
  })
  async getSystemBalances() {
    return await this.assetsService.getSystemBalances();
  }

  @Patch('system/balance')
  @Role(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar el balance de un activo del sistema' })
  @ApiResponse({
    status: 200,
    description: 'Balance del sistema actualizado exitosamente',
  })
  async updateSystemBalance(
    @Body() updateSystemBalanceDto: UpdateSystemBalanceDto,
  ) {
    return await this.assetsService.updateSystemBalance(updateSystemBalanceDto);
  }

  @Patch('system/balances/bulk')
  @Role(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Actualizar múltiples balances del sistema en una operación',
  })
  @ApiResponse({
    status: 200,
    description: 'Balances del sistema actualizados exitosamente',
  })
  async bulkUpdateSystemBalance(
    @Body() bulkUpdateDto: BulkUpdateSystemBalanceDto,
  ) {
    return await this.assetsService.bulkUpdateSystemBalance(bulkUpdateDto);
  }
}
