import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionRuleDto } from './dto/create-transaction-rule.dto';
import { UpdateTransactionRuleDto } from './dto/update-transaction-rule.dto';

@Injectable()
export class TransactionRulesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Verifica si un activo es inmutable
   * @param assetId ID del activo a verificar
   * @returns true si el activo es inmutable, false si no lo es
   */
  private async isAssetImmutable(assetId: string): Promise<boolean> {
    const result = await this.prisma.$queryRaw`
      SELECT "isImmutable" FROM "Asset" WHERE id = ${assetId}
    `;
    return result && result[0] && result[0].isImmutable === true;
  }

  /**
   * Verifica si alguno de los activos involucrados en una regla es inmutable
   * @param sourceAssetId ID del activo de origen
   * @param targetAssetId ID del activo de destino
   * @throws BadRequestException si alguno de los activos es inmutable
   */
  private async checkAssetsImmutability(
    sourceAssetId: string,
    targetAssetId: string,
  ): Promise<void> {
    // Verificar si el activo de origen es inmutable
    const isSourceImmutable = await this.isAssetImmutable(sourceAssetId);
    if (isSourceImmutable) {
      throw new BadRequestException(
        `El activo de origen con ID ${sourceAssetId} es inmutable y sus reglas no pueden ser modificadas`,
      );
    }

    // Verificar si el activo de destino es inmutable
    const isTargetImmutable = await this.isAssetImmutable(targetAssetId);
    if (isTargetImmutable) {
      throw new BadRequestException(
        `El activo de destino con ID ${targetAssetId} es inmutable y sus reglas no pueden ser modificadas`,
      );
    }
  }

  async create(createTransactionRuleDto: CreateTransactionRuleDto) {
    const { sourceAssetId, targetAssetId } = createTransactionRuleDto;

    // Verificar si alguno de los activos es inmutable
    await this.checkAssetsImmutability(sourceAssetId, targetAssetId);

    // Verificar que ambos activos existen
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

    // Verificar que no exista ya una regla con los mismos activos
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
        `Ya existe una regla para convertir de ${sourceAsset.name} a ${targetAsset.name}`,
      );
    }

    return await this.prisma.transactionRule.create({
      data: createTransactionRuleDto,
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

    // Si se está cambiando alguno de los activos, verificar inmutabilidad
    if (
      updateTransactionRuleDto.sourceAssetId ||
      updateTransactionRuleDto.targetAssetId
    ) {
      const sourceAssetId =
        updateTransactionRuleDto.sourceAssetId || rule.sourceAssetId;
      const targetAssetId =
        updateTransactionRuleDto.targetAssetId || rule.targetAssetId;

      // Verificar inmutabilidad de los activos actuales
      await this.checkAssetsImmutability(
        rule.sourceAssetId,
        rule.targetAssetId,
      );

      // Verificar inmutabilidad de los nuevos activos
      await this.checkAssetsImmutability(sourceAssetId, targetAssetId);
    } else {
      // Verificar inmutabilidad de los activos actuales
      await this.checkAssetsImmutability(
        rule.sourceAssetId,
        rule.targetAssetId,
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

    // Verificar inmutabilidad de los activos
    await this.checkAssetsImmutability(rule.sourceAssetId, rule.targetAssetId);

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

    // Verificar inmutabilidad de los activos
    await this.checkAssetsImmutability(rule.sourceAssetId, rule.targetAssetId);

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

    // Verificar inmutabilidad de los activos
    await this.checkAssetsImmutability(rule.sourceAssetId, rule.targetAssetId);

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
