import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  TransactionState,
  MovementType,
  Transaction,
} from '@prisma/client';
import { UpdateTransactionStateDto } from './dto/update-transaction-state.dto';
import { SearchTransactionsDto } from './dto/search-transactions.dto';

// Definir un tipo específico para el retorno
type TransactionResponse = Transaction & {
  details?: any[];
  client?: any;
  clientBalances?: any[];
};

// Definir tipos para las respuestas paginadas
export interface PaginatedItems<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createTransactionDto: CreateTransactionDto,
    userId: string,
  ): Promise<TransactionResponse> {
    const transaction = await this.prisma.$transaction(
      async (tx) => {
        // 1. Verificar que el cliente existe
        const client = await tx.client.findUnique({
          where: { id: createTransactionDto.clientId },
        });

        if (!client) {
          throw new NotFoundException(
            `Cliente con ID ${createTransactionDto.clientId} no encontrado`,
          );
        }

        // 2. Crear la transacción principal
        const transaction = await tx.transaction.create({
          data: {
            clientId: createTransactionDto.clientId,
            date: createTransactionDto.date
              ? new Date(createTransactionDto.date)
              : new Date(),
            state: createTransactionDto.state || TransactionState.PENDING,
            notes: createTransactionDto.notes,
            createdBy: userId,
            ...(createTransactionDto.parentTransactionId && {
              parentTransactionId: createTransactionDto.parentTransactionId,
            }),
          },
        });

        // 3. Si hay detalles, procesarlos y actualizar balances
        if (createTransactionDto.details?.length) {
          // Crear todos los detalles en una sola operación
          await tx.transactionDetail.createMany({
            data: createTransactionDto.details.map((detail) => ({
              transactionId: transaction.id,
              assetId: detail.assetId,
              movementType: detail.movementType,
              amount: detail.amount,
              percentageDifference: detail.percentageDifference,
              notes: detail.notes,
              createdBy: userId,
            })),
          });

          // Solo actualizar balances si el estado no es PENDING
          if (transaction.state !== TransactionState.PENDING) {
            // Procesar actualizaciones de balance de manera optimizada
            const balanceUpdates = createTransactionDto.details.reduce(
              (acc, detail) => {
                const amountChange =
                  detail.movementType === MovementType.INCOME
                    ? detail.amount
                    : -detail.amount;

                acc[detail.assetId] = (acc[detail.assetId] || 0) + amountChange;
                return acc;
              },
              {} as Record<string, number>,
            );

            // Obtener balances existentes del cliente
            const clientBalances = await tx.clientBalance.findMany({
              where: {
                clientId: createTransactionDto.clientId,
                assetId: { in: Object.keys(balanceUpdates) },
              },
            });

            // Obtener el cliente sistema
            const systemClient = await tx.client.findFirst({
              where: { name: 'Casa de Cambio (Sistema)' },
            });

            if (!systemClient) {
              throw new NotFoundException('Cliente sistema no encontrado');
            }

            // Obtener balances existentes del sistema
            const systemBalances = await tx.clientBalance.findMany({
              where: {
                clientId: systemClient.id,
                assetId: { in: Object.keys(balanceUpdates) },
              },
            });

            // Preparar actualizaciones de balance para el cliente
            for (const assetId of Object.keys(balanceUpdates)) {
              const existingClientBalance = clientBalances.find(
                (b) => b.assetId === assetId,
              );

              // Actualizar balance del cliente (inverso al sistema)
              if (existingClientBalance) {
                await tx.clientBalance.update({
                  where: {
                    clientId_assetId: {
                      clientId: createTransactionDto.clientId,
                      assetId: assetId,
                    },
                  },
                  data: {
                    balance:
                      existingClientBalance.balance - balanceUpdates[assetId],
                    transactionId: transaction.id,
                  },
                });
              } else {
                await tx.clientBalance.create({
                  data: {
                    clientId: createTransactionDto.clientId,
                    assetId: assetId,
                    balance: -balanceUpdates[assetId],
                    transactionId: transaction.id,
                  },
                });
              }

              // Actualizar balance del sistema
              const existingSystemBalance = systemBalances.find(
                (b) => b.assetId === assetId,
              );
              if (existingSystemBalance) {
                await tx.clientBalance.update({
                  where: {
                    clientId_assetId: {
                      clientId: systemClient.id,
                      assetId: assetId,
                    },
                  },
                  data: {
                    balance:
                      existingSystemBalance.balance + balanceUpdates[assetId],
                    transactionId: transaction.id,
                  },
                });
              } else {
                await tx.clientBalance.create({
                  data: {
                    clientId: systemClient.id,
                    assetId: assetId,
                    balance: balanceUpdates[assetId],
                    transactionId: transaction.id,
                  },
                });
              }
            }
          }
        }

        // 4. Retornar la transacción creada con sus detalles
        return tx.transaction.findUnique({
          where: { id: transaction.id },
          include: {
            details: true,
            client: true,
            clientBalances: true,
          },
        });
      },
      {
        timeout: 10000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return transaction;
  }

  async findAll(
    page = 1,
    limit = 10,
  ): Promise<PaginatedItems<TransactionResponse>> {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        skip,
        take: limit,
        include: {
          details: true,
          client: true,
          clientBalances: true,
        },
        orderBy: {
          date: 'desc',
        },
      }),
      this.prisma.transaction.count(),
    ]);

    // Formato específico que espera el interceptor
    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<TransactionResponse> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        details: true,
        client: true,
        clientBalances: true,
        childTransactions: {
          include: {
            details: true,
          },
        },
        parentTransaction: true,
        logistics: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }

    return transaction;
  }

  async update(
    id: string,
    updateTransactionDto: UpdateTransactionDto,
    userId: string,
  ): Promise<TransactionResponse> {
    // Verificar que la transacción existe
    const existingTransaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        details: true,
      },
    });

    if (!existingTransaction) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }

    // Verificar si la transacción está completada
    if (existingTransaction.state === TransactionState.COMPLETED) {
      throw new ConflictException(
        'No se puede modificar una transacción completada',
      );
    }

    // Realizar la actualización dentro de una transacción de base de datos
    const transaction = await this.prisma.$transaction(async (tx) => {
      // Actualizar la transacción principal
      const transaction = await tx.transaction.update({
        where: { id },
        data: {
          date: updateTransactionDto.date
            ? new Date(updateTransactionDto.date)
            : undefined,
          notes: updateTransactionDto.notes,
          // No permitimos actualizar el estado aquí, eso se hace con updateState
        },
      });

      // Si hay detalles nuevos, procesarlos
      if (updateTransactionDto.details?.length) {
        // Eliminar detalles anteriores si se indica
        if (updateTransactionDto.replaceDetails) {
          await tx.transactionDetail.deleteMany({
            where: { transactionId: id },
          });
        }

        // Crear los nuevos detalles
        await tx.transactionDetail.createMany({
          data: updateTransactionDto.details.map((detail) => ({
            transactionId: transaction.id,
            assetId: detail.assetId,
            movementType: detail.movementType,
            amount: detail.amount,
            percentageDifference: detail.percentageDifference,
            notes: detail.notes,
            createdBy: userId,
          })),
        });
      }

      // Retornar la transacción actualizada
      return tx.transaction.findUnique({
        where: { id },
        include: {
          details: true,
          client: true,
          clientBalances: true,
        },
      });
    });

    return transaction;
  }

  async updateState(
    id: string,
    updateStateDto: UpdateTransactionStateDto,
    userId: string,
  ): Promise<TransactionResponse> {
    // Verificar que la transacción existe
    const existingTransaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        details: true,
        client: true,
      },
    });

    if (!existingTransaction) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }

    // Validar transición de estado
    if (existingTransaction.state === updateStateDto.state) {
      throw new BadRequestException(
        `La transacción ya está en estado ${updateStateDto.state}`,
      );
    }

    if (existingTransaction.state === TransactionState.COMPLETED) {
      throw new ConflictException(
        'No se puede cambiar el estado de una transacción completada',
      );
    }

    // Si es transición de PENDING a otro estado, debemos actualizar balances
    const needsBalanceUpdate =
      existingTransaction.state === TransactionState.PENDING &&
      updateStateDto.state !== TransactionState.PENDING;

    // Realizar la actualización dentro de una transacción de base de datos
    const transaction = await this.prisma.$transaction(async (tx) => {
      // Actualizar el estado de la transacción
      const transaction = await tx.transaction.update({
        where: { id },
        data: {
          state: updateStateDto.state,
          updatedAt: new Date(),
          createdBy: userId,
        },
      });

      // Si la transacción cambia de PENDING a otro estado, actualizar balances
      if (needsBalanceUpdate && existingTransaction.details.length > 0) {
        // Procesar actualizaciones de balance de manera optimizada
        const balanceUpdates = existingTransaction.details.reduce(
          (acc, detail) => {
            const amountChange =
              detail.movementType === MovementType.INCOME
                ? detail.amount
                : -detail.amount;

            acc[detail.assetId] = (acc[detail.assetId] || 0) + amountChange;
            return acc;
          },
          {} as Record<string, number>,
        );

        // Obtener balances existentes del cliente
        const clientBalances = await tx.clientBalance.findMany({
          where: {
            clientId: existingTransaction.clientId,
            assetId: { in: Object.keys(balanceUpdates) },
          },
        });

        // Obtener el cliente sistema
        const systemClient = await tx.client.findFirst({
          where: { name: 'Casa de Cambio (Sistema)' },
        });

        if (!systemClient) {
          throw new NotFoundException('Cliente sistema no encontrado');
        }

        // Obtener balances existentes del sistema
        const systemBalances = await tx.clientBalance.findMany({
          where: {
            clientId: systemClient.id,
            assetId: { in: Object.keys(balanceUpdates) },
          },
        });

        // Actualizar balances
        for (const assetId of Object.keys(balanceUpdates)) {
          const existingClientBalance = clientBalances.find(
            (b) => b.assetId === assetId,
          );

          // Actualizar balance del cliente (inverso al sistema)
          if (existingClientBalance) {
            await tx.clientBalance.update({
              where: {
                clientId_assetId: {
                  clientId: existingTransaction.clientId,
                  assetId: assetId,
                },
              },
              data: {
                balance:
                  existingClientBalance.balance - balanceUpdates[assetId],
                transactionId: transaction.id,
              },
            });
          } else {
            await tx.clientBalance.create({
              data: {
                clientId: existingTransaction.clientId,
                assetId: assetId,
                balance: -balanceUpdates[assetId],
                transactionId: transaction.id,
              },
            });
          }

          // Actualizar balance del sistema
          const existingSystemBalance = systemBalances.find(
            (b) => b.assetId === assetId,
          );
          if (existingSystemBalance) {
            await tx.clientBalance.update({
              where: {
                clientId_assetId: {
                  clientId: systemClient.id,
                  assetId: assetId,
                },
              },
              data: {
                balance:
                  existingSystemBalance.balance + balanceUpdates[assetId],
                transactionId: transaction.id,
              },
            });
          } else {
            await tx.clientBalance.create({
              data: {
                clientId: systemClient.id,
                assetId: assetId,
                balance: balanceUpdates[assetId],
                transactionId: transaction.id,
              },
            });
          }
        }
      }

      // Retornar la transacción actualizada
      return tx.transaction.findUnique({
        where: { id },
        include: {
          details: true,
          client: true,
          clientBalances: true,
        },
      });
    });

    return transaction;
  }

  async search(
    searchDto: SearchTransactionsDto,
  ): Promise<PaginatedItems<TransactionResponse>> {
    const {
      clientId,
      startDate,
      endDate,
      state,
      parentTransactionId,
      assetId,
      limit = 10,
      offset = 0,
    } = searchDto;

    // Calcular página basada en offset y limit para mantener consistencia
    const page = Math.floor(offset / limit) + 1;

    // Construir condiciones de búsqueda
    const where: Prisma.TransactionWhereInput = {};

    if (clientId) {
      where.clientId = clientId;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

    if (state) {
      where.state = state;
    }

    if (parentTransactionId) {
      where.parentTransactionId = parentTransactionId;
    }

    // Si se especifica assetId, buscar transacciones que tengan este activo en sus detalles
    if (assetId) {
      where.details = {
        some: {
          assetId,
        },
      };
    }

    // Realizar la búsqueda
    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          details: true,
          client: true,
          parentTransaction: {
            include: {
              client: true,
            },
          },
        },
        skip: offset,
        take: limit,
        orderBy: {
          date: 'desc',
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    // Formato específico que espera el interceptor
    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async remove(id: string): Promise<TransactionResponse> {
    // Verificar que la transacción existe
    const existingTransaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        childTransactions: true,
        clientBalances: true,
      },
    });

    if (!existingTransaction) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }

    // Verificar si tiene transacciones hijas
    if (existingTransaction.childTransactions.length > 0) {
      throw new ConflictException(
        'No se puede eliminar una transacción con transacciones hijas',
      );
    }

    // Verificar si está en estado completada
    if (existingTransaction.state === TransactionState.COMPLETED) {
      throw new ConflictException(
        'No se puede eliminar una transacción completada',
      );
    }

    // Realizar la eliminación dentro de una transacción de base de datos
    const transaction = await this.prisma.$transaction(async (tx) => {
      // Eliminar detalles de la transacción
      await tx.transactionDetail.deleteMany({
        where: { transactionId: id },
      });

      // Eliminar logística asociada si existe
      await tx.logistics.deleteMany({
        where: { transactionId: id },
      });

      // Eliminar conciliaciones asociadas
      await tx.reconciliation.deleteMany({
        where: {
          OR: [{ sourceTransactionId: id }, { targetTransactionId: id }],
        },
      });

      // Eliminar balances asociados
      await tx.clientBalance.deleteMany({
        where: { transactionId: id },
      });

      // Finalmente, eliminar la transacción
      return tx.transaction.delete({
        where: { id },
      });
    });

    return transaction;
  }

  async createChildTransaction(
    parentId: string,
    createTransactionDto: CreateTransactionDto,
    userId: string,
  ): Promise<TransactionResponse> {
    // Verificar que la transacción padre existe
    const parentTransaction = await this.prisma.transaction.findUnique({
      where: { id: parentId },
    });

    if (!parentTransaction) {
      throw new NotFoundException(
        `Transacción padre con ID ${parentId} no encontrada`,
      );
    }

    // Asignar la transacción padre
    createTransactionDto.parentTransactionId = parentId;

    // Utilizar el método create para crear la transacción hija
    return this.create(createTransactionDto, userId);
  }
}
