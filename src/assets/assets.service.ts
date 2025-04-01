import { Injectable } from '@nestjs/common';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { AssetType } from '@prisma/client';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAssetDto: CreateAssetDto) {
    const asset = await this.prisma.asset.create({
      data: createAssetDto,
    });

    return asset;
  }

  async findAll(paginationDto: PaginationDto) {
    const {
      page = 1,
      limit = 10,
      order = 'desc',
      sort = 'createdAt',
    } = paginationDto;

    // Si limit es -1, devuelve todos los items
    const take = limit === -1 ? undefined : limit;
    const skip = limit === -1 ? undefined : (page - 1) * limit;

    const [assets, total] = await Promise.all([
      this.prisma.asset.findMany({
        skip: skip,
        take: take,
        orderBy: {
          [sort]: order,
        },
      }),
      this.prisma.asset.count(),
    ]);

    return {
      items: assets,
      pagination: {
        total,
        page: limit === -1 ? 1 : page,
        limit: limit === -1 ? total : limit,
        totalPages: limit === -1 ? 1 : Math.ceil(total / limit),
        hasPreviousPage: limit === -1 ? false : page > 1,
        hasNextPage: limit === -1 ? false : page * limit < total,
      },
    };
  }

  async findOne(id: string) {
    return await this.prisma.asset.findUnique({
      where: { id },
    });
  }

  async update(id: string, updateAssetDto: UpdateAssetDto) {
    return await this.prisma.asset.update({
      where: { id },
      data: updateAssetDto,
    });
  }

  async enable(id: string) {
    return await this.prisma.asset.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async disable(id: string) {
    return await this.prisma.asset.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async findAllType(type: AssetType) {
    return await this.prisma.asset.findMany({
      where: {
        isActive: true,
        type: type,
      },
    });
  }

  async remove(id: string) {
    return await this.prisma.asset.delete({
      where: { id },
    });
  }
}
