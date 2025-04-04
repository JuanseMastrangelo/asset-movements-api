import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDenominationDto } from './dto/create-denomination.dto';
import { UpdateDenominationDto } from './dto/update-denomination.dto';

@Injectable()
export class DenominationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDenominationDto: CreateDenominationDto) {
    // Verificar que el activo existe
    const asset = await this.prisma.asset.findUnique({
      where: { id: createDenominationDto.assetId },
    });

    if (!asset) {
      throw new NotFoundException(
        `Activo con ID ${createDenominationDto.assetId} no encontrado`,
      );
    }

    // Verificar si ya existe una denominación con el mismo valor para este activo
    const existingDenomination = await this.prisma.denomination.findUnique({
      where: {
        assetId_value: {
          assetId: createDenominationDto.assetId,
          value: createDenominationDto.value,
        },
      },
    });

    if (existingDenomination) {
      throw new ConflictException(
        `Ya existe una denominación con valor ${createDenominationDto.value} para este activo`,
      );
    }

    // Crear la denominación
    return this.prisma.denomination.create({
      data: {
        assetId: createDenominationDto.assetId,
        value: createDenominationDto.value,
        isActive: createDenominationDto.isActive ?? true,
      },
    });
  }

  async findAll(assetId?: string) {
    const where = assetId ? { assetId } : {};

    return this.prisma.denomination.findMany({
      where,
      include: {
        asset: {
          select: {
            name: true,
            type: true,
          },
        },
      },
      orderBy: [{ assetId: 'asc' }, { value: 'desc' }],
    });
  }

  async findOne(id: string) {
    const denomination = await this.prisma.denomination.findUnique({
      where: { id },
      include: {
        asset: {
          select: {
            name: true,
            type: true,
          },
        },
      },
    });

    if (!denomination) {
      throw new NotFoundException(`Denominación con ID ${id} no encontrada`);
    }

    return denomination;
  }

  async update(id: string, updateDenominationDto: UpdateDenominationDto) {
    // Verificar que la denominación existe
    await this.findOne(id);

    // Verificar si cambia el valor, hay que validar que no exista otro con el mismo valor
    if (
      updateDenominationDto.value !== undefined &&
      updateDenominationDto.assetId !== undefined
    ) {
      const existingDenomination = await this.prisma.denomination.findUnique({
        where: {
          assetId_value: {
            assetId: updateDenominationDto.assetId,
            value: updateDenominationDto.value,
          },
        },
      });

      if (existingDenomination && existingDenomination.id !== id) {
        throw new ConflictException(
          `Ya existe una denominación con valor ${updateDenominationDto.value} para este activo`,
        );
      }
    }

    return this.prisma.denomination.update({
      where: { id },
      data: updateDenominationDto,
      include: {
        asset: {
          select: {
            name: true,
            type: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    // Verificar que la denominación existe
    await this.findOne(id);

    // Verificar si la denominación está siendo utilizada en detalles de billetes
    const billDetails = await this.prisma.billDetail.findFirst({
      where: { denominationId: id },
    });

    if (billDetails) {
      throw new ConflictException(
        `No se puede eliminar la denominación porque está siendo utilizada en transacciones`,
      );
    }

    return this.prisma.denomination.delete({
      where: { id },
    });
  }

  async findByAssetId(assetId: string) {
    const denominations = await this.prisma.denomination.findMany({
      where: {
        assetId,
        isActive: true,
      },
      orderBy: { value: 'desc' },
    });

    return denominations;
  }
}
