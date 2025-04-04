import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchAuditDto } from './dto/search-audit.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async createAuditLog(params: {
    entityType: string;
    entityId: string;
    action: string;
    changedData: any;
    changedBy: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        changedData: params.changedData,
        changedBy: params.changedBy,
      },
    });
  }

  async findAll(searchDto: SearchAuditDto) {
    const {
      changedBy,
      entityType,
      entityId,
      action,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = searchDto;

    const where: any = {};

    if (changedBy) {
      where.changedBy = changedBy;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (action) {
      where.action = action;
    }

    if (startDate || endDate) {
      where.changedAt = {};
      if (startDate) {
        where.changedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.changedAt.lte = new Date(endDate);
      }
    }

    const skip = (page - 1) * limit;
    const take = limit;

    const [auditLogs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: {
          changedAt: 'desc',
        },
        include: {
          changedByUser: {
            select: {
              username: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: auditLogs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Método de utilidad para obtener y formatear los roles para el frontend
  getRoles() {
    const roles = Object.values(UserRole);
    return roles.map((role) => ({
      value: role,
      label: this.formatRoleName(role),
    }));
  }

  private formatRoleName(role: string): string {
    return role
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
