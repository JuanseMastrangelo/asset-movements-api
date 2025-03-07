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
} from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { TransformResponseInterceptor } from 'src/common/interceptor/transform.response.interceptor';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { AssetType } from '@prisma/client';

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
}
