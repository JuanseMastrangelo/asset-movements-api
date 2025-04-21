import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { AssetType } from '@prisma/client';
import { UpdateSystemBalanceDto } from './dto/update-system-balance.dto';
import { BulkUpdateSystemBalanceDto } from './dto/bulk-update-system-balance.dto';

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
    // Si no se proporcionan parámetros de paginación explícitamente,
    // devolver todos los assets sin estructura de paginación
    if (!paginationDto.page) {
      const assets = await this.prisma.asset.findMany({
        where: { isActive: true },
        orderBy: {
          createdAt: 'desc',
        },
      });
      return assets;
    }

    // Proceso normal de paginación cuando se envían parámetros
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
    // Verificar si el activo existe
    const existingAsset = await this.prisma.asset.findUnique({
      where: { id },
    });

    if (!existingAsset) {
      throw new NotFoundException(`Activo con ID ${id} no encontrado`);
    }

    // Consulta personalizada para verificar la inmutabilidad
    const result = await this.prisma.$queryRaw`
      SELECT "isImmutable" FROM "Asset" WHERE id = ${id}
    `;

    // Verificar si el activo es inmutable
    if (result && result[0] && result[0].isImmutable === true) {
      throw new BadRequestException(
        `El activo con ID ${id} es inmutable y no puede ser modificado`,
      );
    }

    return await this.prisma.asset.update({
      where: { id },
      data: updateAssetDto,
    });
  }

  async enable(id: string) {
    // Verificar si el activo es inmutable
    const result = await this.prisma.$queryRaw`
      SELECT "isImmutable" FROM "Asset" WHERE id = ${id}
    `;

    // Verificar si el activo es inmutable
    if (result && result[0] && result[0].isImmutable === true) {
      throw new BadRequestException(
        `El activo con ID ${id} es inmutable y no puede ser modificado`,
      );
    }

    return await this.prisma.asset.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async disable(id: string) {
    // Verificar si el activo es inmutable
    const result = await this.prisma.$queryRaw`
      SELECT "isImmutable" FROM "Asset" WHERE id = ${id}
    `;

    // Verificar si el activo es inmutable
    if (result && result[0] && result[0].isImmutable === true) {
      throw new BadRequestException(
        `El activo con ID ${id} es inmutable y no puede ser desactivado`,
      );
    }

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
    // Verificar si el activo es inmutable
    const result = await this.prisma.$queryRaw`
      SELECT "isImmutable" FROM "Asset" WHERE id = ${id}
    `;

    // Verificar si el activo es inmutable
    if (result && result[0] && result[0].isImmutable === true) {
      throw new BadRequestException(
        `El activo con ID ${id} es inmutable y no puede ser eliminado`,
      );
    }

    return await this.prisma.asset.delete({
      where: { id },
    });
  }

  /**
   * Obtiene el cliente del sistema
   * @returns Cliente del sistema
   * @throws NotFoundException si el cliente del sistema no existe
   */
  private async getSystemClient() {
    const systemClient = await this.prisma.client.findFirst({
      where: { name: 'Casa de Cambio (Sistema)' },
    });

    if (!systemClient) {
      throw new NotFoundException('Cliente sistema no encontrado');
    }

    return systemClient;
  }

  /**
   * Actualiza el balance de un activo específico para el cliente del sistema
   * @param updateSystemBalanceDto DTO con el ID del activo y el nuevo balance
   * @returns El balance actualizado
   */
  async updateSystemBalance(updateSystemBalanceDto: UpdateSystemBalanceDto) {
    const { assetId, balance } = updateSystemBalanceDto;

    // Verificar que el activo existe
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId, isActive: true },
    });

    if (!asset) {
      throw new NotFoundException(
        `Activo con ID ${assetId} no encontrado o inactivo`,
      );
    }

    // Obtener el cliente del sistema
    const systemClient = await this.getSystemClient();

    // Actualizar o crear el balance del sistema para este activo
    const updatedBalance = await this.prisma.clientBalance.upsert({
      where: {
        clientId_assetId: {
          clientId: systemClient.id,
          assetId: assetId,
        },
      },
      update: {
        balance: balance,
      },
      create: {
        clientId: systemClient.id,
        assetId: assetId,
        balance: balance,
      },
    });

    return {
      asset: {
        id: asset.id,
        name: asset.name,
        type: asset.type,
      },
      balance: updatedBalance.balance,
    };
  }

  /**
   * Actualiza múltiples balances del sistema en una sola operación
   * @param bulkUpdateDto DTO con array de activos y sus nuevos balances
   * @returns Objeto con los balances actualizados
   */
  async bulkUpdateSystemBalance(bulkUpdateDto: BulkUpdateSystemBalanceDto) {
    // Obtener el cliente del sistema
    const systemClient = await this.getSystemClient();

    // Verificar que todos los activos existen
    const assetIds = bulkUpdateDto.balances.map((item) => item.assetId);

    const existingAssets = await this.prisma.asset.findMany({
      where: {
        id: { in: assetIds },
        isActive: true,
      },
    });

    if (existingAssets.length !== assetIds.length) {
      const foundIds = existingAssets.map((asset) => asset.id);
      const missingIds = assetIds.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(
        `No se encontraron los siguientes activos o están inactivos: ${missingIds.join(', ')}`,
      );
    }

    // Actualizar cada balance en una transacción
    const updatedBalances = await this.prisma.$transaction(
      bulkUpdateDto.balances.map(({ assetId, balance }) =>
        this.prisma.clientBalance.upsert({
          where: {
            clientId_assetId: {
              clientId: systemClient.id,
              assetId: assetId,
            },
          },
          update: {
            balance: balance,
          },
          create: {
            clientId: systemClient.id,
            assetId: assetId,
            balance: balance,
          },
        }),
      ),
    );

    // Formatear la respuesta
    return {
      systemId: systemClient.id,
      systemName: systemClient.name,
      balances: updatedBalances.map((balance) => {
        const asset = existingAssets.find((a) => a.id === balance.assetId);
        return {
          assetId: balance.assetId,
          assetName: asset?.name,
          assetType: asset?.type,
          balance: balance.balance,
        };
      }),
    };
  }

  /**
   * Obtiene los balances actuales del sistema
   * @returns Balances del sistema agrupados por activo
   */
  async getSystemBalances() {
    // Obtener el cliente sistema
    const systemClient = await this.getSystemClient();

    // Obtener todos los activos activos
    const assets = await this.prisma.asset.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
      },
      orderBy: {
        type: 'asc',
      },
    });

    // Obtener los balances del sistema
    const systemBalances = await this.prisma.clientBalance.findMany({
      where: {
        clientId: systemClient.id,
      },
    });

    // Mapear los activos con sus cantidades
    const balances = assets.map((asset) => {
      const balance = systemBalances.find(
        (balance) => balance.assetId === asset.id,
      );

      return {
        id: asset.id,
        name: asset.name,
        description: asset.description,
        type: asset.type,
        balance: balance?.balance || 0,
      };
    });

    return {
      systemId: systemClient.id,
      systemName: systemClient.name,
      balances,
    };
  }
}
