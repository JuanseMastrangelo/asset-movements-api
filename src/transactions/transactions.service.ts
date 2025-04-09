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
import { CreatePartialTransactionDto } from './dto/create-partial-transaction.dto';
import { CompletePendingTransactionDto } from './dto/complete-pending-transaction.dto';

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

  // Agregamos esta función para procesar los detalles de billetes
  private async processBillDetails(
    tx: any,
    transactionDetailId: string,
    billDetails: any[],
  ) {
    if (!billDetails || billDetails.length === 0) {
      return;
    }

    // Eliminar cualquier detalle de billetes existente
    await tx.billDetail.deleteMany({
      where: {
        transactionDetailId,
      },
    });

    // Crear los nuevos detalles de billetes
    await tx.billDetail.createMany({
      data: billDetails.map((detail) => ({
        transactionDetailId,
        denominationId: detail.denominationId,
        quantity: detail.quantity,
      })),
    });

    // Verificar que la suma de denominaciones coincide con el monto del detalle de transacción
    const transactionDetail = await tx.transactionDetail.findUnique({
      where: { id: transactionDetailId },
    });

    const denominations = await tx.denomination.findMany({
      where: {
        id: {
          in: billDetails.map((d) => d.denominationId),
        },
      },
    });

    const billsSum = billDetails.reduce((sum, billDetail) => {
      const denomination = denominations.find(
        (d) => d.id === billDetail.denominationId,
      );
      if (!denomination) return sum;
      return sum + denomination.value * billDetail.quantity;
    }, 0);

    // Si hay una diferencia significativa, actualizar el detalle con una nota
    const difference = Math.abs(billsSum - transactionDetail.amount);
    if (difference > 0.01) {
      // Tolerancia de 0.01 para errores de redondeo
      await tx.transactionDetail.update({
        where: { id: transactionDetailId },
        data: {
          notes: `${transactionDetail.notes || ''} [ADVERTENCIA: El monto total de billetes (${billsSum}) no coincide con el monto del detalle (${transactionDetail.amount})]`,
        },
      });
    }
  }

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
          // Crear los detalles en el bucle para poder procesar los billetes para cada uno
          for (const detail of createTransactionDto.details) {
            const createdDetail = await tx.transactionDetail.create({
              data: {
                transactionId: transaction.id,
                assetId: detail.assetId,
                movementType: detail.movementType,
                amount: detail.amount,
                percentageDifference: detail.percentageDifference,
                notes: detail.notes,
                createdBy: userId,
              },
            });

            // Si hay detalles de billetes, procesarlos
            if (detail.billDetails?.length) {
              await this.processBillDetails(
                tx,
                createdDetail.id,
                detail.billDetails,
              );
            }
          }

          // Solo actualizar balances si el estado no es PENDING
          if (transaction.state !== TransactionState.PENDING) {
            // Obtener los detalles para actualizar balances
            const transactionDetails = await tx.transactionDetail.findMany({
              where: { transactionId: transaction.id },
            });

            // Procesar actualizaciones de balance de manera optimizada
            const balanceUpdates = transactionDetails.reduce(
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
            details: {
              include: {
                billDetails: {
                  include: {
                    denomination: true,
                  },
                },
              },
            },
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
    includeCancelled = false,
  ): Promise<PaginatedItems<TransactionResponse>> {
    const skip = (page - 1) * limit;

    try {
      // Construir la condición de filtro usando el ORM en lugar de SQL directo
      const whereCondition: Prisma.TransactionWhereInput = {};

      // Solo excluir transacciones canceladas si se especifica
      if (!includeCancelled) {
        // En lugar de excluir CANCELLED, incluimos explícitamente los estados que queremos
        whereCondition.state = {
          in: [TransactionState.PENDING, TransactionState.COMPLETED],
        };
      }

      // Usar findMany y count de Prisma
      const [items, total] = await Promise.all([
        this.prisma.transaction.findMany({
          where: whereCondition,
          skip,
          take: limit,
          orderBy: {
            date: 'desc',
          },
          include: {
            details: true,
            client: true,
            clientBalances: true,
          },
        }),
        this.prisma.transaction.count({
          where: whereCondition,
        }),
      ]);

      // Formato específico para la respuesta
      return {
        items,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error en findAll:', error);
      // Devolver un resultado vacío para evitar errores 500
      return {
        items: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      };
    }
  }

  async findOne(id: string): Promise<TransactionResponse> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        details: {
          include: {
            billDetails: {
              include: {
                denomination: true,
              },
            },
          },
        },
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
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        details: true,
        client: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }

    // No se puede modificar una transacción completada o cancelada
    if (
      transaction.state === TransactionState.COMPLETED ||
      transaction.state === TransactionState.CANCELLED
    ) {
      throw new ConflictException(
        `No se puede modificar una transacción en estado ${transaction.state}`,
      );
    }

    // Procesar actualización de transacción dentro de una transacción de BD
    return this.prisma.$transaction(
      async (tx) => {
        // 1. Actualizar datos básicos de la transacción
        const updateData: any = {};

        if (updateTransactionDto.clientId) {
          updateData.clientId = updateTransactionDto.clientId;
        }

        if (updateTransactionDto.date) {
          updateData.date = new Date(updateTransactionDto.date);
        }

        if (updateTransactionDto.notes) {
          updateData.notes = updateTransactionDto.notes;
        }

        if (updateTransactionDto.state) {
          updateData.state = updateTransactionDto.state;
        }

        // 2. Manejar la lógica de actualización parcial si se especifica un porcentaje
        let newPendingTransaction;

        // Si se está completando parcialmente (se especifica un porcentaje)
        if (
          updateTransactionDto.completionPercentage &&
          updateTransactionDto.completionPercentage < 100 &&
          updateTransactionDto.completionPercentage > 0
        ) {
          // Actualizar estado a COMPLETED o CURRENT_ACCOUNT según lo que venga
          updateData.state =
            updateTransactionDto.state || TransactionState.CURRENT_ACCOUNT;

          // Porcentaje a completar
          const completionPercentage =
            updateTransactionDto.completionPercentage;

          // Actualizar la transacción principal
          await tx.transaction.update({
            where: { id },
            data: updateData,
          });

          // Si se solicita crear transacción hija para el restante
          if (updateTransactionDto.createChildForRemaining !== false) {
            // Crear una nueva transacción para la parte que queda pendiente
            newPendingTransaction = await tx.transaction.create({
              data: {
                clientId: transaction.clientId,
                date: transaction.date,
                state: TransactionState.PENDING,
                notes: `${transaction.notes || ''} (Saldo pendiente: ${100 - completionPercentage}%)`,
                createdBy: userId,
                parentTransactionId: transaction.id,
              },
            });

            // 2.1 Crear detalles para la nueva transacción pendiente
            const pendingDetails = [];

            for (const detail of transaction.details) {
              const remainingAmount =
                detail.amount * (1 - completionPercentage / 100);

              if (remainingAmount > 0) {
                pendingDetails.push({
                  transactionId: newPendingTransaction.id,
                  assetId: detail.assetId,
                  movementType: detail.movementType,
                  amount: remainingAmount,
                  percentageDifference: detail.percentageDifference,
                  notes: `${detail.notes || ''} (Parte pendiente: ${100 - completionPercentage}%)`,
                  createdBy: userId,
                });
              }
            }

            if (pendingDetails.length > 0) {
              await tx.transactionDetail.createMany({
                data: pendingDetails,
              });
            }

            // 2.2 Actualizar los detalles de la transacción actual
            for (const detail of transaction.details) {
              const completedAmount =
                detail.amount * (completionPercentage / 100);

              await tx.transactionDetail.update({
                where: { id: detail.id },
                data: {
                  amount: completedAmount,
                  notes: `${detail.notes || ''} (Parte completada: ${completionPercentage}%)`,
                  updatedAt: new Date(),
                },
              });
            }
          }
        } else {
          // Actualización regular sin completado parcial
          await tx.transaction.update({
            where: { id },
            data: updateData,
          });
        }

        // 3. Procesar detalles actualizados si se proporcionan
        if (updateTransactionDto.details?.length) {
          // Para cada detalle actualizado
          for (const updatedDetail of updateTransactionDto.details) {
            // Buscar el detalle existente
            const existingDetail = transaction.details.find(
              (d) =>
                d.assetId === updatedDetail.assetId &&
                d.movementType === updatedDetail.movementType,
            );

            if (existingDetail) {
              // Actualizar detalle existente
              await tx.transactionDetail.update({
                where: { id: existingDetail.id },
                data: {
                  amount:
                    updatedDetail.amount !== undefined
                      ? updatedDetail.amount
                      : existingDetail.amount,
                  percentageDifference: updatedDetail.percentageDifference,
                  notes: updatedDetail.notes,
                  updatedAt: new Date(),
                },
              });

              // Procesar detalles de billetes si se proporcionan
              if (updatedDetail.billDetails?.length) {
                await this.processBillDetails(
                  tx,
                  existingDetail.id,
                  updatedDetail.billDetails,
                );
              }
            } else {
              // Crear nuevo detalle
              const newDetail = await tx.transactionDetail.create({
                data: {
                  transactionId: id,
                  assetId: updatedDetail.assetId,
                  movementType: updatedDetail.movementType,
                  amount: updatedDetail.amount,
                  percentageDifference: updatedDetail.percentageDifference,
                  notes: updatedDetail.notes,
                  createdBy: userId,
                },
              });

              // Procesar detalles de billetes para el nuevo detalle
              if (updatedDetail.billDetails?.length) {
                await this.processBillDetails(
                  tx,
                  newDetail.id,
                  updatedDetail.billDetails,
                );
              }
            }
          }
        }

        // 4. Si el estado cambió a CURRENT_ACCOUNT o COMPLETED, actualizar balances
        if (
          (transaction.state === TransactionState.PENDING &&
            (updateData.state === TransactionState.CURRENT_ACCOUNT ||
              updateData.state === TransactionState.COMPLETED)) ||
          (transaction.state === TransactionState.CURRENT_ACCOUNT &&
            updateData.state === TransactionState.COMPLETED)
        ) {
          // Obtener los detalles actualizados
          const transactionDetails = await tx.transactionDetail.findMany({
            where: { transactionId: id },
          });

          // Procesar actualizaciones de balance
          const balanceUpdates = transactionDetails.reduce(
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
              clientId: transaction.clientId,
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
                    clientId: transaction.clientId,
                    assetId: assetId,
                  },
                },
                data: {
                  balance:
                    existingClientBalance.balance - balanceUpdates[assetId],
                  transactionId: id,
                },
              });
            } else {
              await tx.clientBalance.create({
                data: {
                  clientId: transaction.clientId,
                  assetId: assetId,
                  balance: -balanceUpdates[assetId],
                  transactionId: id,
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
                  transactionId: id,
                },
              });
            } else {
              await tx.clientBalance.create({
                data: {
                  clientId: systemClient.id,
                  assetId: assetId,
                  balance: balanceUpdates[assetId],
                  transactionId: id,
                },
              });
            }
          }
        }

        // 5. Registrar cambio en log de auditoría
        await tx.auditLog.create({
          data: {
            entityType: 'Transaction',
            entityId: id,
            action: 'Actualización de transacción',
            changedData: {
              clientId: updateTransactionDto.clientId,
              date: updateTransactionDto.date,
              state: updateTransactionDto.state,
              notes: updateTransactionDto.notes,
              completionPercentage: updateTransactionDto.completionPercentage,
              details: updateTransactionDto.details
                ? 'Se actualizaron los detalles'
                : undefined,
            },
            changedBy: userId,
          },
        });

        // 6. Retornar la transacción actualizada con sus detalles
        const result = await tx.transaction.findUnique({
          where: { id },
          include: {
            details: {
              include: {
                billDetails: {
                  include: {
                    denomination: true,
                  },
                },
                asset: true,
              },
            },
            client: true,
            clientBalances: true,
          },
        });

        // 7. Si se creó una transacción pendiente, incluirla en el log
        if (newPendingTransaction) {
          await tx.auditLog.create({
            data: {
              entityType: 'Transaction',
              entityId: newPendingTransaction.id,
              action: 'Creación de transacción pendiente',
              changedData: {
                parentTransactionId: id,
                completionPercentage: updateTransactionDto.completionPercentage,
              },
              changedBy: userId,
            },
          });
        }

        return result;
      },
      { maxWait: 15000, timeout: 30000 },
    );
  }

  async updateState(
    id: string,
    updateStateDto: UpdateTransactionStateDto,
    userId: string,
  ): Promise<TransactionResponse> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        details: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }

    // Validar la transición de estados
    if (transaction.state === TransactionState.COMPLETED) {
      throw new BadRequestException(
        'No se puede cambiar el estado de una transacción COMPLETED',
      );
    }

    if (transaction.state === TransactionState.CANCELLED) {
      throw new BadRequestException(
        'No se puede cambiar el estado de una transacción CANCELLED',
      );
    }

    if (
      transaction.state === TransactionState.PENDING &&
      updateStateDto.state === TransactionState.PENDING
    ) {
      throw new BadRequestException(
        'La transacción ya se encuentra en estado PENDING',
      );
    }

    if (
      transaction.state === TransactionState.CURRENT_ACCOUNT &&
      updateStateDto.state === TransactionState.CURRENT_ACCOUNT
    ) {
      throw new BadRequestException(
        'La transacción ya se encuentra en estado CURRENT_ACCOUNT',
      );
    }

    // Realizar la actualización dentro de una transacción de base de datos
    return this.prisma.$transaction(
      async (tx) => {
        // Actualizar el estado de la transacción
        await tx.transaction.update({
          where: { id },
          data: {
            state: updateStateDto.state,
            notes: updateStateDto.notes
              ? `${transaction.notes || ''} | ${updateStateDto.notes}`
              : transaction.notes,
            updatedAt: new Date(), // Asegurar que se actualiza la fecha
          },
        });

        // Si se proporcionaron detalles actualizados y el estado es CURRENT_ACCOUNT o COMPLETED
        if (
          updateStateDto.updatedDetails?.length &&
          (updateStateDto.state === TransactionState.CURRENT_ACCOUNT ||
            updateStateDto.state === TransactionState.COMPLETED)
        ) {
          // Procesar cada detalle actualizado
          for (const updatedDetail of updateStateDto.updatedDetails) {
            // Buscar el detalle original
            const originalDetail = transaction.details.find(
              (detail) =>
                detail.assetId === updatedDetail.assetId &&
                detail.movementType === updatedDetail.movementType,
            );

            if (originalDetail) {
              // Actualizar el detalle existente
              await tx.transactionDetail.update({
                where: { id: originalDetail.id },
                data: {
                  amount: updatedDetail.amount || originalDetail.amount,
                  percentageDifference:
                    updatedDetail.percentageDifference ||
                    originalDetail.percentageDifference,
                  notes: updatedDetail.notes
                    ? `${originalDetail.notes || ''} | ${updatedDetail.notes}`
                    : originalDetail.notes,
                  createdBy: userId, // Usar userId para registrar quién hizo el cambio
                },
              });

              // Procesar detalles de billetes si existen
              if (updatedDetail.billDetails?.length) {
                await this.processBillDetails(
                  tx,
                  originalDetail.id,
                  updatedDetail.billDetails,
                );
              }
            }
          }
        }

        // Si el estado cambia a CURRENT_ACCOUNT o COMPLETED, actualizar balances
        if (
          (transaction.state === TransactionState.PENDING &&
            (updateStateDto.state === TransactionState.CURRENT_ACCOUNT ||
              updateStateDto.state === TransactionState.COMPLETED)) ||
          (transaction.state === TransactionState.CURRENT_ACCOUNT &&
            updateStateDto.state === TransactionState.COMPLETED)
        ) {
          // Obtener los detalles actualizados
          const transactionDetails = await tx.transactionDetail.findMany({
            where: { transactionId: id },
          });

          // Procesar actualizaciones de balance
          const balanceUpdates = transactionDetails.reduce(
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
              clientId: transaction.clientId,
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
                    clientId: transaction.clientId,
                    assetId: assetId,
                  },
                },
                data: {
                  balance:
                    existingClientBalance.balance - balanceUpdates[assetId],
                  transactionId: id,
                },
              });
            } else {
              await tx.clientBalance.create({
                data: {
                  clientId: transaction.clientId,
                  assetId: assetId,
                  balance: -balanceUpdates[assetId],
                  transactionId: id,
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
                  transactionId: id,
                },
              });
            } else {
              await tx.clientBalance.create({
                data: {
                  clientId: systemClient.id,
                  assetId: assetId,
                  balance: balanceUpdates[assetId],
                  transactionId: id,
                },
              });
            }
          }
        }

        // Registrar cambio de estado en log de auditoría
        await tx.auditLog.create({
          data: {
            entityType: 'Transaction',
            entityId: id,
            action: `Estado actualizado a ${updateStateDto.state}`,
            changedData: {
              previousState: transaction.state,
              newState: updateStateDto.state,
            },
            changedBy: userId,
          },
        });

        // Buscar la transacción actualizada con sus detalles
        return tx.transaction.findUnique({
          where: { id },
          include: {
            details: {
              include: {
                billDetails: {
                  include: {
                    denomination: true,
                  },
                },
                asset: true,
              },
            },
            client: true,
            clientBalances: true,
          },
        });
      },
      { maxWait: 15000, timeout: 30000 },
    );
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
      childTransactionId,
      assetId,
      limit = 10,
      offset = 0,
      includeCancelled = false,
    } = searchDto;

    // Calcular página basada en offset y limit para mantener consistencia
    const page = Math.floor(offset / limit) + 1;

    // Construir condiciones de búsqueda
    const where: any = {}; // Usar tipo 'any' para evitar errores de TypeScript

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
    } else if (!includeCancelled) {
      // Si no se especifica un estado y no se incluyen canceladas, incluir solo los estados válidos
      where.state = {
        in: [TransactionState.PENDING, TransactionState.COMPLETED],
      };
    }

    // Si se especifica parentTransactionId, buscar las transacciones hijas
    if (parentTransactionId) {
      try {
        // Verificar primero que la transacción padre existe
        const parentExists = await this.prisma.transaction.findUnique({
          where: { id: parentTransactionId },
          select: { id: true },
        });

        if (!parentExists) {
          // Si el padre no existe, devolver un array vacío en lugar de error
          return {
            items: [],
            pagination: {
              total: 0,
              page,
              limit,
              totalPages: 0,
            },
          };
        }

        // Si existe, usarlo en la consulta
        // Podemos tener dos casos:
        // 1. Transacciones hijas que tienen este ID como parentTransactionId
        // 2. La propia transacción padre (si queremos ver tanto padre como hijas)
        where.OR = [
          { parentTransactionId: parentTransactionId },
          { id: parentTransactionId },
        ];
      } catch (error) {
        console.error(
          `Error al verificar transacción padre ${parentTransactionId}:`,
          error,
        );
        // En caso de error (como formato UUID inválido), devolver array vacío
        return {
          items: [],
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        };
      }
    }

    // Si se especifica childTransactionId, buscar la transacción padre
    // (Esto debe ser una consulta separada ya que la estructura es diferente)
    if (childTransactionId) {
      try {
        // Primero obtenemos la transacción hija para conocer su parentTransactionId
        const childTransaction = await this.prisma.transaction.findUnique({
          where: { id: childTransactionId },
          select: { parentTransactionId: true, id: true },
        });

        // Si la transacción hija existe
        if (childTransaction) {
          if (childTransaction.parentTransactionId) {
            // Si el ID de la transacción hija es igual a su propio parentTransactionId
            // (caso de autorreferencia), buscamos directamente por el ID
            if (childTransaction.id === childTransaction.parentTransactionId) {
              where.id = childTransactionId;
            } else {
              // Caso normal: buscamos la transacción padre
              where.id = childTransaction.parentTransactionId;
            }
          } else {
            // Si no tiene parentTransactionId, buscamos directamente por el ID
            // por si es un caso de transacción padre que no tiene su propio ID como parentTransactionId
            where.id = childTransactionId;
          }
        } else {
          // Si no hay transacción hija, devolver resultado vacío
          return {
            items: [],
            pagination: {
              total: 0,
              page,
              limit,
              totalPages: 0,
            },
          };
        }
      } catch (error) {
        console.error(
          `Error al buscar transacción hija ${childTransactionId}:`,
          error,
        );
        // En caso de error (como formato UUID inválido), devolver array vacío
        return {
          items: [],
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        };
      }
    }

    // Si se especifica assetId, buscar transacciones que tengan este activo en sus detalles
    if (assetId) {
      try {
        // Verificar que el activo existe
        const assetExists = await this.prisma.asset.findUnique({
          where: { id: assetId },
          select: { id: true },
        });

        if (!assetExists) {
          // Si el activo no existe, devolver un array vacío en lugar de error
          return {
            items: [],
            pagination: {
              total: 0,
              page,
              limit,
              totalPages: 0,
            },
          };
        }

        // Si existe, usarlo en la consulta
        where.details = {
          some: {
            assetId,
          },
        };
      } catch (error) {
        console.error(`Error al verificar activo ${assetId}:`, error);
        // En caso de error (como formato UUID inválido), devolver array vacío
        return {
          items: [],
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        };
      }
    }

    // Realizar la búsqueda
    try {
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
    } catch (error) {
      console.error('Error al realizar la búsqueda de transacciones:', error);
      // En caso de error en la búsqueda principal, devolver un array vacío
      return {
        items: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      };
    }
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
      include: { details: true },
    });

    if (!parentTransaction) {
      throw new NotFoundException(
        `Transacción padre con ID ${parentId} no encontrada`,
      );
    }

    // Si no tiene estado PENDING, no debería aceptar hijas
    if (parentTransaction.state !== TransactionState.PENDING) {
      throw new BadRequestException(
        `Solo se pueden crear transacciones hijas para transacciones en estado PENDING. Estado actual: ${parentTransaction.state}`,
      );
    }

    // Verificar que el cliente coincide
    if (createTransactionDto.clientId !== parentTransaction.clientId) {
      throw new BadRequestException(
        'El cliente de la transacción hija debe ser el mismo que el de la transacción padre',
      );
    }

    // Modificar el DTO para incluir la relación con la transacción padre
    const childTransactionDto = {
      ...createTransactionDto,
      parentTransactionId: parentId,
      state: TransactionState.CURRENT_ACCOUNT, // Las transacciones hijas van directo a afectar el balance
    };

    // Crear la transacción hija
    const childTransaction = await this.create(childTransactionDto, userId);

    // Si la transacción hija completa la transacción padre, actualizar el estado de la padre
    // Calculamos el total pendiente vs. el total cubierto por las hijas
    const childTransactions = await this.prisma.transaction.findMany({
      where: {
        parentTransactionId: parentId,
        state: {
          in: [TransactionState.CURRENT_ACCOUNT, TransactionState.COMPLETED],
        },
      },
      include: { details: true },
    });

    // Agrupar los detalles del padre por assetId y movementType
    const parentDetailsMap = parentTransaction.details.reduce((acc, detail) => {
      const key = `${detail.assetId}-${detail.movementType}`;
      if (!acc[key]) {
        acc[key] = {
          assetId: detail.assetId,
          movementType: detail.movementType,
          amount: 0,
        };
      }
      acc[key].amount += detail.amount;
      return acc;
    }, {});

    // Sumar los detalles de las hijas por assetId y movementType
    const childrenDetailsMap = {};
    childTransactions.forEach((child) => {
      child.details.forEach((detail) => {
        const key = `${detail.assetId}-${detail.movementType}`;
        if (!childrenDetailsMap[key]) {
          childrenDetailsMap[key] = {
            assetId: detail.assetId,
            movementType: detail.movementType,
            amount: 0,
          };
        }
        childrenDetailsMap[key].amount += detail.amount;
      });
    });

    // Comprobar si todos los detalles del padre están cubiertos por las hijas
    let allDetailsCovered = true;
    for (const key in parentDetailsMap) {
      const childAmount = childrenDetailsMap[key]?.amount || 0;
      if (childAmount < parentDetailsMap[key].amount) {
        allDetailsCovered = false;
        break;
      }
    }

    // Si todos los detalles están cubiertos, marcar la transacción padre como completada
    if (allDetailsCovered) {
      await this.prisma.transaction.update({
        where: { id: parentId },
        data: {
          state: TransactionState.COMPLETED,
          notes: `${parentTransaction.notes || ''} (Completada mediante transacciones hijas)`,
        },
      });
    }

    return childTransaction;
  }

  async createPartialTransaction(
    createPartialTransactionDto: CreatePartialTransactionDto,
    userId: string,
  ): Promise<{
    initialTransaction: TransactionResponse;
    pendingTransaction: TransactionResponse;
  }> {
    // Validar los datos de entrada
    if (!createPartialTransactionDto.details?.length) {
      throw new BadRequestException(
        'La transacción debe tener al menos un detalle',
      );
    }

    if (
      !createPartialTransactionDto.initialPercentage &&
      !createPartialTransactionDto.useDirectAmounts
    ) {
      throw new BadRequestException(
        'Debe especificar un porcentaje inicial o usar montos directos',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        // 1. Verificar que el cliente existe
        const client = await tx.client.findUnique({
          where: { id: createPartialTransactionDto.clientId },
        });

        if (!client) {
          throw new NotFoundException(
            `Cliente con ID ${createPartialTransactionDto.clientId} no encontrado`,
          );
        }

        // 2. Crear la transacción principal (será la pendiente)
        const pendingTransaction = await tx.transaction.create({
          data: {
            clientId: createPartialTransactionDto.clientId,
            date: createPartialTransactionDto.date
              ? new Date(createPartialTransactionDto.date)
              : new Date(),
            state: TransactionState.PENDING,
            notes: `${createPartialTransactionDto.notes || ''} (Transacción pendiente)`,
            createdBy: userId,
          },
        });

        // 3. Crear la transacción inicial (la que se completa parcialmente)
        const initialTransaction = await tx.transaction.create({
          data: {
            clientId: createPartialTransactionDto.clientId,
            date: createPartialTransactionDto.date
              ? new Date(createPartialTransactionDto.date)
              : new Date(),
            state: TransactionState.COMPLETED, // Esta se completa inmediatamente
            notes: `${createPartialTransactionDto.notes || ''} (Transacción parcial inicial)`,
            createdBy: userId,
            parentTransactionId: pendingTransaction.id, // La pendiente es la "principal"
          },
        });

        // 4. Procesar los detalles
        const initialPercentage =
          createPartialTransactionDto.initialPercentage || 50; // Default 50% si no se especifica

        // Arrays para almacenar los detalles de cada transacción
        const initialDetails = [];
        const pendingDetails = [];

        // 5. Dividir los detalles según el porcentaje o montos directos
        for (const detail of createPartialTransactionDto.details) {
          let initialAmount: number;
          let pendingAmount: number;

          if (createPartialTransactionDto.useDirectAmounts) {
            // Si usamos montos directos, el monto original es la suma
            initialAmount = detail.amount;
            pendingAmount = detail.amount * (1 - initialPercentage / 100);
          } else {
            // Si usamos porcentaje, calculamos las partes
            initialAmount = detail.amount * (initialPercentage / 100);
            pendingAmount = detail.amount - initialAmount;
          }

          // Crear detalle para la transacción inicial
          initialDetails.push({
            transactionId: initialTransaction.id,
            assetId: detail.assetId,
            movementType: detail.movementType,
            amount: initialAmount,
            percentageDifference: detail.percentageDifference,
            notes: `${detail.notes || ''} (Parte inicial: ${initialPercentage}%)`,
            createdBy: userId,
          });

          // Crear detalle para la transacción pendiente
          pendingDetails.push({
            transactionId: pendingTransaction.id,
            assetId: detail.assetId,
            movementType: detail.movementType,
            amount: pendingAmount,
            percentageDifference: detail.percentageDifference,
            notes: `${detail.notes || ''} (Parte pendiente: ${100 - initialPercentage}%)`,
            createdBy: userId,
          });
        }

        // 6. Guardar los detalles
        if (initialDetails.length > 0) {
          await tx.transactionDetail.createMany({
            data: initialDetails,
          });
        }

        if (pendingDetails.length > 0) {
          await tx.transactionDetail.createMany({
            data: pendingDetails,
          });
        }

        // 7. Actualizar balances para la transacción inicial (ya que está COMPLETED)
        const balanceUpdates = initialDetails.reduce(
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
            clientId: createPartialTransactionDto.clientId,
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
                  clientId: createPartialTransactionDto.clientId,
                  assetId: assetId,
                },
              },
              data: {
                balance:
                  existingClientBalance.balance - balanceUpdates[assetId],
                transactionId: initialTransaction.id,
              },
            });
          } else {
            await tx.clientBalance.create({
              data: {
                clientId: createPartialTransactionDto.clientId,
                assetId: assetId,
                balance: -balanceUpdates[assetId],
                transactionId: initialTransaction.id,
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
                transactionId: initialTransaction.id,
              },
            });
          } else {
            await tx.clientBalance.create({
              data: {
                clientId: systemClient.id,
                assetId: assetId,
                balance: balanceUpdates[assetId],
                transactionId: initialTransaction.id,
              },
            });
          }
        }

        // 8. Retornar ambas transacciones creadas con sus detalles
        const [initialResult, pendingResult] = await Promise.all([
          tx.transaction.findUnique({
            where: { id: initialTransaction.id },
            include: {
              details: true,
              client: true,
              clientBalances: true,
            },
          }),
          tx.transaction.findUnique({
            where: { id: pendingTransaction.id },
            include: {
              details: true,
              client: true,
            },
          }),
        ]);

        return {
          initialTransaction: initialResult,
          pendingTransaction: pendingResult,
        };
      },
      {
        timeout: 15000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async completePendingTransaction(
    id: string,
    completePendingTransactionDto: CompletePendingTransactionDto,
    userId: string,
  ): Promise<TransactionResponse> {
    // Verificar que la transacción existe y está pendiente
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        details: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }

    if (transaction.state !== TransactionState.PENDING) {
      throw new BadRequestException(
        `Solo se pueden completar transacciones en estado PENDING. Estado actual: ${transaction.state}`,
      );
    }

    const completionPercentage =
      completePendingTransactionDto.completionPercentage || 100;

    if (completionPercentage <= 0 || completionPercentage > 100) {
      throw new BadRequestException(
        'El porcentaje de completado debe estar entre 1 y 100',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        // Si se completa parcialmente (menos del 100%), necesitamos crear una nueva transacción pendiente
        if (completionPercentage < 100) {
          // 1. Crear una nueva transacción para la parte que aún queda pendiente
          const newPendingTransaction = await tx.transaction.create({
            data: {
              clientId: transaction.clientId,
              date: transaction.date,
              state: TransactionState.PENDING,
              notes: `${transaction.notes} (Saldo pendiente: ${100 - completionPercentage}%)`,
              createdBy: userId,
            },
          });

          // 2. Crear detalles para la nueva transacción pendiente
          const newPendingDetails = [];
          for (const detail of transaction.details) {
            const remainingAmount =
              detail.amount * (1 - completionPercentage / 100);

            if (remainingAmount > 0) {
              newPendingDetails.push({
                transactionId: newPendingTransaction.id,
                assetId: detail.assetId,
                movementType: detail.movementType,
                amount: remainingAmount,
                percentageDifference: detail.percentageDifference,
                notes: `${detail.notes || ''} (Parte pendiente: ${100 - completionPercentage}%)`,
                createdBy: userId,
              });
            }
          }

          if (newPendingDetails.length > 0) {
            await tx.transactionDetail.createMany({
              data: newPendingDetails,
            });
          }

          // 3. Actualizar la transacción actual para reflejar solo la parte que se completa
          await tx.transaction.update({
            where: { id },
            data: {
              state: TransactionState.COMPLETED,
              notes: `${transaction.notes || ''} (Completado: ${completionPercentage}%)`,
              updatedAt: new Date(),
            },
          });

          // 4. Actualizar los detalles de la transacción actual
          for (const detail of transaction.details) {
            const completedAmount =
              detail.amount * (completionPercentage / 100);

            await tx.transactionDetail.update({
              where: { id: detail.id },
              data: {
                amount: completedAmount,
                notes: `${detail.notes || ''} (Parte completada: ${completionPercentage}%)`,
                updatedAt: new Date(),
              },
            });
          }
        } else {
          // Completar el 100% de la transacción
          await tx.transaction.update({
            where: { id },
            data: {
              state: TransactionState.COMPLETED,
              notes: completePendingTransactionDto.notes
                ? `${transaction.notes || ''} ${completePendingTransactionDto.notes}`
                : transaction.notes,
              updatedAt: new Date(),
            },
          });

          // Si hay detalles personalizados, actualizar los detalles existentes
          if (completePendingTransactionDto.customDetails?.length) {
            // Eliminar detalles anteriores
            await tx.transactionDetail.deleteMany({
              where: { transactionId: id },
            });

            // Crear los nuevos detalles
            await tx.transactionDetail.createMany({
              data: completePendingTransactionDto.customDetails.map(
                (detail) => ({
                  transactionId: id,
                  assetId: detail.assetId,
                  movementType: detail.movementType,
                  amount: detail.amount,
                  percentageDifference: detail.percentageDifference,
                  notes: detail.notes,
                  createdBy: userId,
                }),
              ),
            });
          }
        }

        // Obtener los detalles actualizados de la transacción para calcular balances
        const updatedTransaction = await tx.transaction.findUnique({
          where: { id },
          include: {
            details: true,
          },
        });

        // Procesar actualizaciones de balance
        const balanceUpdates = updatedTransaction.details.reduce(
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
            clientId: transaction.clientId,
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
                  clientId: transaction.clientId,
                  assetId: assetId,
                },
              },
              data: {
                balance:
                  existingClientBalance.balance - balanceUpdates[assetId],
                transactionId: id,
              },
            });
          } else {
            await tx.clientBalance.create({
              data: {
                clientId: transaction.clientId,
                assetId: assetId,
                balance: -balanceUpdates[assetId],
                transactionId: id,
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
                transactionId: id,
              },
            });
          } else {
            await tx.clientBalance.create({
              data: {
                clientId: systemClient.id,
                assetId: assetId,
                balance: balanceUpdates[assetId],
                transactionId: id,
              },
            });
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
      },
      {
        timeout: 15000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  /**
   * Cancela una transacción cambiando su estado a CANCELLED
   * Solo las transacciones en estado PENDING pueden ser canceladas
   */
  async cancel(id: string, userId: string): Promise<TransactionResponse> {
    // Verificar que la transacción existe
    const existingTransaction = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!existingTransaction) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }

    // Verificar que la transacción esté en estado PENDING
    if (existingTransaction.state !== TransactionState.PENDING) {
      throw new BadRequestException(
        'Solo se pueden cancelar transacciones en estado PENDING',
      );
    }

    try {
      // En lugar de actualizar el estado directamente, usamos una sentencia SQL sin procesar
      // a través del método executeRaw de Prisma
      await this.prisma.$executeRaw`
        UPDATE "Transaction"
        SET "state" = ${TransactionState.CANCELLED}, "updatedAt" = NOW(), "createdBy" = ${userId}
        WHERE "id" = ${id}
      `;

      // Obtener la transacción actualizada
      const transaction = await this.prisma.transaction.findUnique({
        where: { id },
        include: {
          details: true,
          client: true,
          clientBalances: true,
        },
      });

      if (!transaction) {
        throw new NotFoundException(
          `Transacción con ID ${id} no encontrada después de cancelar`,
        );
      }

      return transaction;
    } catch (error) {
      console.error('Error al cancelar la transacción:', error);
      throw new BadRequestException(
        `Error al cancelar la transacción: ${error.message}`,
      );
    }
  }
}
