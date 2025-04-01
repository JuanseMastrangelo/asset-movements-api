import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionRuleDto } from './dto/create-transaction-rule.dto';
import { UpdateTransactionRuleDto } from './dto/update-transaction-rule.dto';

@Injectable()
export class TransactionRulesService {
  constructor(private prisma: PrismaService) {}

  async create(createTransactionRuleDto: CreateTransactionRuleDto) {
    const {
      sourceAssetId,
      targetAssetId,
      isEnabled = true,
    } = createTransactionRuleDto;

    // Verificar que existan ambos activos
    const [sourceAsset, targetAsset] = await Promise.all([
      this.prisma.asset.findUnique({ where: { id: sourceAssetId } }),
      this.prisma.asset.findUnique({ where: { id: targetAssetId } }),
    ]);

    if (!sourceAsset) {
      throw new NotFoundException(
        `El activo de origen con ID ${sourceAssetId} no existe`,
      );
    }

    if (!targetAsset) {
      throw new NotFoundException(
        `El activo de destino con ID ${targetAssetId} no existe`,
      );
    }

    // Verificar que no exista ya la regla
    const existingRule = await this.prisma.transactionRule.findUnique({
      where: {
        sourceAssetId_targetAssetId: {
          sourceAssetId,
          targetAssetId,
        },
      },
    });

    if (existingRule) {
      throw new ConflictException(
        `Ya existe una regla para la conversión de ${sourceAsset.name} a ${targetAsset.name}`,
      );
    }

    return await this.prisma.transactionRule.create({
      data: {
        sourceAssetId,
        targetAssetId,
        isEnabled,
      },
      include: {
        sourceAsset: true,
        targetAsset: true,
      },
    });
  }

  async findAll() {
    return await this.prisma.transactionRule.findMany({
      include: {
        sourceAsset: true,
        targetAsset: true,
      },
    });
  }

  async findAllForAsset(assetId: string) {
    return await this.prisma.transactionRule.findMany({
      where: {
        OR: [{ sourceAssetId: assetId }, { targetAssetId: assetId }],
      },
      include: {
        sourceAsset: true,
        targetAsset: true,
      },
    });
  }

  async findOne(id: string) {
    const rule = await this.prisma.transactionRule.findUnique({
      where: { id },
      include: {
        sourceAsset: true,
        targetAsset: true,
      },
    });

    if (!rule) {
      throw new NotFoundException(
        `La regla de transacción con ID ${id} no existe`,
      );
    }

    return rule;
  }

  async update(id: string, updateTransactionRuleDto: UpdateTransactionRuleDto) {
    const rule = await this.prisma.transactionRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException(
        `La regla de transacción con ID ${id} no existe`,
      );
    }

    return await this.prisma.transactionRule.update({
      where: { id },
      data: updateTransactionRuleDto,
      include: {
        sourceAsset: true,
        targetAsset: true,
      },
    });
  }

  async remove(id: string) {
    const rule = await this.prisma.transactionRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException(
        `La regla de transacción con ID ${id} no existe`,
      );
    }

    return await this.prisma.transactionRule.delete({
      where: { id },
      include: {
        sourceAsset: true,
        targetAsset: true,
      },
    });
  }

  async canConvert(sourceAssetId: string, targetAssetId: string) {
    const rule = await this.prisma.transactionRule.findUnique({
      where: {
        sourceAssetId_targetAssetId: {
          sourceAssetId,
          targetAssetId,
        },
      },
    });

    return rule ? rule.isEnabled : false;
  }

  async enable(id: string) {
    const rule = await this.prisma.transactionRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException(
        `La regla de transacción con ID ${id} no existe`,
      );
    }

    return await this.prisma.transactionRule.update({
      where: { id },
      data: { isEnabled: true },
      include: {
        sourceAsset: true,
        targetAsset: true,
      },
    });
  }

  async disable(id: string) {
    const rule = await this.prisma.transactionRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException(
        `La regla de transacción con ID ${id} no existe`,
      );
    }

    return await this.prisma.transactionRule.update({
      where: { id },
      data: { isEnabled: false },
      include: {
        sourceAsset: true,
        targetAsset: true,
      },
    });
  }
}
