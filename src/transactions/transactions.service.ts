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
import { CreateReconciliationDto } from './dto/create-reconciliation.dto';
import { FindClientsForReconciliationDto } from './dto/find-clients-for-reconciliation.dto';
import { ConciliateImmutableAssetsDto } from './dto/conciliate-immutable-assets.dto';

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
    try {
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
              // Validar que el movementType no esté vacío
              if (!detail.movementType) {
                throw new BadRequestException(
                  `El campo movementType es requerido para cada detalle de la transacción`,
                );
              }

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
                  // Para el balance del cliente:
                  // - Si el cliente ENTREGA (INCOME), debe DISMINUIR su deuda, por lo tanto su balance DISMINUYE (valor negativo)
                  // - Si el cliente RECIBE (EXPENSE), debe AUMENTAR su deuda, por lo tanto su balance AUMENTA (valor positivo)
                  const amountChange =
                    detail.movementType === MovementType.INCOME
                      ? -detail.amount // Cliente entrega, su deuda disminuye (balance disminuye)
                      : detail.amount; // Cliente recibe, su deuda aumenta (balance aumenta)

                  acc[detail.assetId] =
                    (acc[detail.assetId] || 0) + amountChange;
                  return acc;
                },
                {} as Record<string, number>,
              );

              // Calcular actualizaciones de balance para el sistema (inverso al cliente)
              const systemBalanceUpdates = Object.entries(
                balanceUpdates,
              ).reduce(
                (acc, [assetId, amount]) => {
                  // Para el balance del sistema:
                  // - Si el cliente ENTREGA (INCOME), el sistema RECIBE, por lo tanto el balance del sistema AUMENTA
                  // - Si el cliente RECIBE (EXPENSE), el sistema ENTREGA, por lo tanto el balance del sistema DISMINUYE
                  acc[assetId] = -1 * amount; // El sistema tiene el efecto opuesto al cliente
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
                  assetId: { in: Object.keys(systemBalanceUpdates) },
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
                        existingClientBalance.balance + balanceUpdates[assetId],
                      transactionId: transaction.id,
                    },
                  });
                } else {
                  await tx.clientBalance.create({
                    data: {
                      clientId: createTransactionDto.clientId,
                      assetId: assetId,
                      balance: balanceUpdates[assetId],
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
                        existingSystemBalance.balance +
                        systemBalanceUpdates[assetId],
                      transactionId: transaction.id,
                    },
                  });
                } else {
                  await tx.clientBalance.create({
                    data: {
                      clientId: systemClient.id,
                      assetId: assetId,
                      balance: systemBalanceUpdates[assetId],
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
                  asset: true,
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
    } catch (error) {
      console.error('Error en create:', error);
      throw new BadRequestException(
        `Error al crear la transacción: ${error.message}`,
      );
    }
  }

  async findAll(
    page = 1,
    limit = 10,
    includeCancelled = false,
  ): Promise<PaginatedItems<TransactionResponse>> {
    try {
      const skip = (page - 1) * limit;

      // Construir filtro base
      const where: Prisma.TransactionWhereInput = {};

      // Si no se solicita incluir canceladas, excluirlas usando los estados que queremos incluir
      if (!includeCancelled) {
        where.state = {
          in: [
            TransactionState.PENDING,
            TransactionState.CURRENT_ACCOUNT,
            TransactionState.COMPLETED,
          ],
        };
      }

      // Ejecutar la consulta
      const [transactions, total] = await Promise.all([
        this.prisma.transaction.findMany({
          skip,
          take: limit,
          where,
          orderBy: {
            date: 'desc',
          },
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
            childTransactions: {
              select: {
                id: true,
                state: true,
                date: true,
              },
            },
            parentTransaction: {
              select: {
                id: true,
                state: true,
              },
            },
          },
        }),
        this.prisma.transaction.count({ where }),
      ]);

      // Calcular total de páginas
      const totalPages = Math.ceil(total / limit);

      return {
        items: transactions,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      };
    } catch (error) {
      console.error('Error en findAll:', error);
      throw new BadRequestException(
        `Error al buscar transacciones: ${error.message}`,
      );
    }
  }

  async findOne(id: string): Promise<TransactionResponse> {
    try {
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
              asset: true,
            },
          },
          client: true,
          clientBalances: true,
          childTransactions: {
            select: {
              id: true,
              state: true,
              date: true,
              notes: true,
              details: {
                select: {
                  assetId: true,
                  movementType: true,
                  amount: true,
                  notes: true,
                  id: true,
                },
              },
            },
          },
          parentTransaction: {
            select: {
              id: true,
              state: true,
              date: true,
              notes: true,
            },
          },
        },
      });

      if (!transaction) {
        throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
      }

      return transaction;
    } catch (error) {
      console.error('Error en findOne:', error);
      throw new BadRequestException(
        `Error al buscar la transacción: ${error.message}`,
      );
    }
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
              // Para el balance del cliente:
              // - Si el cliente ENTREGA (INCOME), debe DISMINUIR su deuda, por lo tanto su balance DISMINUYE (valor negativo)
              // - Si el cliente RECIBE (EXPENSE), debe AUMENTAR su deuda, por lo tanto su balance AUMENTA (valor positivo)
              const amountChange =
                detail.movementType === MovementType.INCOME
                  ? -detail.amount // Cliente entrega, su deuda disminuye (balance disminuye)
                  : detail.amount; // Cliente recibe, su deuda aumenta (balance aumenta)

              acc[detail.assetId] = (acc[detail.assetId] || 0) + amountChange;
              return acc;
            },
            {} as Record<string, number>,
          );

          // Calcular actualizaciones de balance para el sistema (inverso al cliente)
          const systemBalanceUpdates = Object.entries(balanceUpdates).reduce(
            (acc, [assetId, amount]) => {
              // Para el balance del sistema:
              // - Si el cliente ENTREGA (INCOME), el sistema RECIBE, por lo tanto el balance del sistema AUMENTA
              // - Si el cliente RECIBE (EXPENSE), el sistema ENTREGA, por lo tanto el balance del sistema DISMINUYE
              acc[assetId] = -1 * Number(amount); // El sistema tiene el efecto opuesto al cliente
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
              assetId: { in: Object.keys(systemBalanceUpdates) },
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
                    existingClientBalance.balance + balanceUpdates[assetId],
                  transactionId: id,
                },
              });
            } else {
              await tx.clientBalance.create({
                data: {
                  clientId: transaction.clientId,
                  assetId: assetId,
                  balance: balanceUpdates[assetId],
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
                    existingSystemBalance.balance +
                    systemBalanceUpdates[assetId], // Usar systemBalanceUpdates en lugar de -balanceUpdates
                  transactionId: id,
                },
              });
            } else {
              await tx.clientBalance.create({
                data: {
                  clientId: systemClient.id,
                  assetId: assetId,
                  balance: systemBalanceUpdates[assetId], // Usar systemBalanceUpdates en lugar de -balanceUpdates
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
              // Para el balance del cliente:
              // - Si el cliente ENTREGA (INCOME), debe DISMINUIR su deuda, por lo tanto su balance DISMINUYE (valor negativo)
              // - Si el cliente RECIBE (EXPENSE), debe AUMENTAR su deuda, por lo tanto su balance AUMENTA (valor positivo)
              const amountChange =
                detail.movementType === MovementType.INCOME
                  ? -detail.amount // Cliente entrega, su deuda disminuye (balance disminuye)
                  : detail.amount; // Cliente recibe, su deuda aumenta (balance aumenta)

              acc[detail.assetId] = (acc[detail.assetId] || 0) + amountChange;
              return acc;
            },
            {} as Record<string, number>,
          );

          // Calcular actualizaciones de balance para el sistema (inverso al cliente)
          const systemBalanceUpdates = Object.entries(balanceUpdates).reduce(
            (acc, [assetId, amount]) => {
              // Para el balance del sistema:
              // - Si el cliente ENTREGA (INCOME), el sistema RECIBE, por lo tanto el balance del sistema AUMENTA
              // - Si el cliente RECIBE (EXPENSE), el sistema ENTREGA, por lo tanto el balance del sistema DISMINUYE
              acc[assetId] = -1 * Number(amount); // El sistema tiene el efecto opuesto al cliente
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
              assetId: { in: Object.keys(systemBalanceUpdates) },
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
                    existingClientBalance.balance + balanceUpdates[assetId],
                  transactionId: id,
                },
              });
            } else {
              await tx.clientBalance.create({
                data: {
                  clientId: transaction.clientId,
                  assetId: assetId,
                  balance: balanceUpdates[assetId],
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
                    existingSystemBalance.balance +
                    systemBalanceUpdates[assetId], // Usar systemBalanceUpdates en lugar de -balanceUpdates
                  transactionId: id,
                },
              });
            } else {
              await tx.clientBalance.create({
                data: {
                  clientId: systemClient.id,
                  assetId: assetId,
                  balance: systemBalanceUpdates[assetId], // Usar systemBalanceUpdates en lugar de -balanceUpdates
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
    try {
      const {
        page = 1,
        limit = 10,
        clientId,
        startDate,
        endDate,
        state,
        assetId,
        minAmount,
        maxAmount,
        parentTransactionId,
        sortBy = 'date',
        sortOrder = 'desc',
        includeCancelled = false,
      } = searchDto;

      const skip = (page - 1) * limit;

      // Construir filtro base
      const where: Prisma.TransactionWhereInput = {};

      // Aplicar filtros si se proporcionan
      if (clientId) {
        where.clientId = clientId;
      }

      if (state) {
        where.state = state;
      } else if (!includeCancelled) {
        where.state = {
          in: [
            TransactionState.PENDING,
            TransactionState.CURRENT_ACCOUNT,
            TransactionState.COMPLETED,
          ],
        };
      }

      if (parentTransactionId) {
        where.parentTransactionId = parentTransactionId;
      }

      // Filtro de fecha
      if (startDate || endDate) {
        where.date = {};
        if (startDate) {
          where.date.gte = new Date(startDate);
        }
        if (endDate) {
          where.date.lte = new Date(endDate);
        }
      }

      // Filtro por assetId y monto
      if (assetId || minAmount !== undefined || maxAmount !== undefined) {
        where.details = {
          some: {
            ...(assetId && { assetId }),
            ...(minAmount !== undefined && { amount: { gte: minAmount } }),
            ...(maxAmount !== undefined && { amount: { lte: maxAmount } }),
          },
        };
      }

      // Ejecutar la consulta
      const [transactions, total] = await Promise.all([
        this.prisma.transaction.findMany({
          skip,
          take: limit,
          where,
          orderBy: {
            [sortBy]: sortOrder,
          },
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
            childTransactions: {
              select: {
                id: true,
                state: true,
                date: true,
                notes: true,
              },
            },
            parentTransaction: {
              select: {
                id: true,
                state: true,
                notes: true,
              },
            },
          },
        }),
        this.prisma.transaction.count({ where }),
      ]);

      // Calcular total de páginas
      const totalPages = Math.ceil(total / limit);

      return {
        items: transactions,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      };
    } catch (error) {
      console.error('Error en search:', error);
      throw new BadRequestException(
        `Error al buscar transacciones: ${error.message}`,
      );
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
    try {
      console.log(
        `[DEBUG] Iniciando createChildTransaction para parentId: ${parentId}`,
      );
      console.log(
        `[DEBUG] DTO recibido:`,
        JSON.stringify(createTransactionDto, null, 2),
      );

      // Verificar que la transacción padre existe
      const parentTransaction = await this.prisma.transaction.findUnique({
        where: { id: parentId },
        include: { details: true },
      });

      console.log(
        `[DEBUG] Parent transaction:`,
        parentTransaction ? 'Encontrada' : 'No encontrada',
      );

      if (!parentTransaction) {
        throw new NotFoundException(
          `Transacción padre con ID ${parentId} no encontrada`,
        );
      }

      // Verificar que la transacción padre está en un estado que permite crear hijas
      if (
        parentTransaction.state !== TransactionState.PENDING &&
        parentTransaction.state !== TransactionState.CURRENT_ACCOUNT
      ) {
        console.log(
          `[DEBUG] Estado de parent transaction:`,
          parentTransaction.state,
        );
        throw new BadRequestException(
          `Solo se pueden crear transacciones hijas para transacciones en estado PENDING o CURRENT_ACCOUNT. Estado actual: ${parentTransaction.state}`,
        );
      }

      // Verificar que el cliente coincide
      console.log(
        `[DEBUG] Cliente padre: ${parentTransaction.clientId}, Cliente DTO: ${createTransactionDto.clientId}`,
      );

      if (createTransactionDto.clientId !== parentTransaction.clientId) {
        throw new BadRequestException(
          'El cliente de la transacción hija debe ser el mismo que el de la transacción padre',
        );
      }

      return this.prisma.$transaction(
        async (tx) => {
          console.log(`[DEBUG] Iniciando transacción de BD`);

          // Modificar el DTO para incluir la relación con la transacción padre
          const childTransactionDto = {
            ...createTransactionDto,
            parentTransactionId: parentId,
            state: TransactionState.CURRENT_ACCOUNT, // Las transacciones hijas van directo a afectar el balance
          };

          // Actualizar la transacción padre a CURRENT_ACCOUNT
          try {
            console.log(
              `[DEBUG] Actualizando transacción padre a CURRENT_ACCOUNT`,
            );
            await tx.transaction.update({
              where: { id: parentId },
              data: {
                state: TransactionState.CURRENT_ACCOUNT,
                notes: parentTransaction.notes
                  ? `${parentTransaction.notes} | Actualizada a CURRENT_ACCOUNT por creación de transacción hija`
                  : 'Actualizada a CURRENT_ACCOUNT por creación de transacción hija',
              },
            });
          } catch (error) {
            console.error(
              `[ERROR] Error al actualizar transacción padre:`,
              error,
            );
            throw error;
          }

          // Crear la transacción hija
          let childTransactionData;
          try {
            console.log(`[DEBUG] Creando transacción hija`);
            childTransactionData = await this.create(
              childTransactionDto,
              userId,
            );
            console.log(
              `[DEBUG] Transacción hija creada con ID: ${childTransactionData?.id || 'N/A'}`,
            );
          } catch (error) {
            console.error(`[ERROR] Error al crear transacción hija:`, error);
            throw error;
          }

          // Registrar cambio en log de auditoría
          try {
            console.log(`[DEBUG] Registrando en log de auditoría`);
            await tx.auditLog.create({
              data: {
                entityType: 'Transaction',
                entityId: parentId,
                action:
                  'Actualización a CURRENT_ACCOUNT por creación de transacción hija',
                changedData: {
                  previousState: TransactionState.PENDING,
                  newState: TransactionState.CURRENT_ACCOUNT,
                  childTransactionId: childTransactionData.id,
                },
                changedBy: userId,
              },
            });
          } catch (error) {
            console.error(`[ERROR] Error al crear log de auditoría:`, error);
            throw error;
          }

          // Obtener los detalles actualizados de la transacción padre
          let updatedParentTransaction;
          try {
            console.log(
              `[DEBUG] Obteniendo detalles actualizados de la transacción padre`,
            );
            updatedParentTransaction = await tx.transaction.findUnique({
              where: { id: parentId },
              include: {
                details: true,
              },
            });
          } catch (error) {
            console.error(
              `[ERROR] Error al obtener detalles actualizados:`,
              error,
            );
            throw error;
          }

          // Obtener todas las transacciones hijas para verificar si está completa
          let childTransactions;
          try {
            console.log(`[DEBUG] Obteniendo transacciones hijas`);
            childTransactions = await tx.transaction.findMany({
              where: {
                parentTransactionId: parentId,
                state: {
                  in: [
                    TransactionState.CURRENT_ACCOUNT,
                    TransactionState.COMPLETED,
                  ],
                },
              },
              include: { details: true },
            });
            console.log(
              `[DEBUG] Número de transacciones hijas encontradas: ${childTransactions.length}`,
            );
          } catch (error) {
            console.error(
              `[ERROR] Error al obtener transacciones hijas:`,
              error,
            );
            throw error;
          }

          // Agrupar los detalles del padre por assetId y movementType
          console.log(`[DEBUG] Agrupando detalles del padre`);
          const parentDetailsMap = {};
          for (const detail of updatedParentTransaction.details) {
            const key = `${detail.assetId}-${detail.movementType}`;
            if (!parentDetailsMap[key]) {
              parentDetailsMap[key] = {
                amount: 0,
                assetId: detail.assetId,
                movementType: detail.movementType,
              };
            }
            parentDetailsMap[key].amount += detail.amount;
          }
          console.log(
            `[DEBUG] Detalles del padre agrupados:`,
            JSON.stringify(parentDetailsMap),
          );

          // Sumar los detalles de las hijas por assetId y movementType
          console.log(`[DEBUG] Agrupando detalles de las hijas`);
          const childDetailsMap = {};
          for (const child of childTransactions) {
            for (const detail of child.details) {
              const key = `${detail.assetId}-${detail.movementType}`;
              if (!childDetailsMap[key]) {
                childDetailsMap[key] = {
                  amount: 0,
                  assetId: detail.assetId,
                  movementType: detail.movementType,
                };
              }
              childDetailsMap[key].amount += detail.amount;
            }
          }
          console.log(
            `[DEBUG] Detalles de las hijas agrupados:`,
            JSON.stringify(childDetailsMap),
          );

          // Comprobar si todos los detalles del padre están cubiertos por las hijas
          console.log(`[DEBUG] Verificando cobertura de detalles`);
          let allDetailsCovered = true;
          for (const key in parentDetailsMap) {
            const parentAmount = parentDetailsMap[key].amount;
            const childAmount = childDetailsMap[key]?.amount || 0;
            console.log(
              `[DEBUG] Comparando clave ${key}: padre=${parentAmount}, hijos=${childAmount}`,
            );
            if (parentAmount - childAmount > 0.01) {
              // Margen para errores de redondeo
              allDetailsCovered = false;
              console.log(`[DEBUG] Detalle no cubierto completamente: ${key}`);
              break;
            }
          }
          console.log(
            `[DEBUG] ¿Todos los detalles están cubiertos? ${allDetailsCovered}`,
          );

          // Calcular los balances pendientes para actualizar correctamente
          console.log(`[DEBUG] Calculando balances pendientes`);
          const pendingBalances = {};
          for (const key in parentDetailsMap) {
            // Obtener el assetId y movementType directamente del objeto
            const assetId = parentDetailsMap[key].assetId; // Usar el ID completo del objeto
            const movementType = parentDetailsMap[key].movementType;

            const parentAmount = parentDetailsMap[key].amount;
            const childAmount = childDetailsMap[key]?.amount || 0;

            // Solo calcular si queda algo pendiente
            const pendingAmount = parentAmount - childAmount;
            if (Math.abs(pendingAmount) > 0.01) {
              // Inicializar el balance si no existe
              pendingBalances[assetId] = pendingBalances[assetId] || 0;

              // Actualizar según el tipo de movimiento
              if (movementType === MovementType.INCOME) {
                // Para INCOME, el cliente debe entregar dinero (pendiente positivo)
                pendingBalances[assetId] += pendingAmount;
              } else {
                // Para EXPENSE, el sistema debe entregar dinero (pendiente negativo)
                pendingBalances[assetId] -= pendingAmount;
              }
            } else {
              // Si el pendiente es cero o casi cero, asegurarse que el balance quede en cero
              pendingBalances[assetId] = 0;
            }
          }
          console.log(
            `[DEBUG] Balances pendientes calculados (IDs completos):`,
            JSON.stringify(pendingBalances),
          );

          // Obtener el cliente sistema
          let systemClient;
          try {
            console.log(`[DEBUG] Buscando cliente sistema`);
            systemClient = await tx.client.findFirst({
              where: { name: 'Casa de Cambio (Sistema)' },
            });
            console.log(
              `[DEBUG] Cliente sistema encontrado:`,
              systemClient ? systemClient.id : 'No encontrado',
            );
          } catch (error) {
            console.error(`[ERROR] Error al buscar cliente sistema:`, error);
            throw error;
          }

          if (!systemClient) {
            throw new NotFoundException('Cliente sistema no encontrado');
          }

          // Actualizar balances del cliente
          console.log(`[DEBUG] Actualizando balances del cliente`);
          for (const assetId in pendingBalances) {
            // Verificar que el activo existe antes de continuar
            try {
              const asset = await tx.asset.findUnique({
                where: { id: assetId },
              });

              if (!asset) {
                console.error(
                  `[ERROR] El activo con ID ${assetId} no existe en la base de datos`,
                );
                continue; // Saltar este activo y continuar con el siguiente
              }

              console.log(
                `[DEBUG] Activo verificado: ${asset.name} (${asset.id})`,
              );
            } catch (error) {
              console.error(
                `[ERROR] Error al verificar activo ${assetId}:`,
                error,
              );
              continue; // Saltar este activo y continuar con el siguiente
            }

            // Buscar balance existente
            let existingBalance;
            try {
              console.log(
                `[DEBUG] Buscando balance existente para assetId: ${assetId}`,
              );
              existingBalance = await tx.clientBalance.findUnique({
                where: {
                  clientId_assetId: {
                    clientId: updatedParentTransaction.clientId,
                    assetId,
                  },
                },
              });
              console.log(
                `[DEBUG] Balance existente:`,
                existingBalance
                  ? `ID: ${existingBalance.id}, Valor: ${existingBalance.balance}`
                  : 'No encontrado',
              );
            } catch (error) {
              console.error(
                `[ERROR] Error al buscar balance existente:`,
                error,
              );
              continue; // Continuar con el siguiente en lugar de abortar todo
            }

            try {
              // Verificar si el balance pendiente es 0 (totalmente cubierto)
              const balanceValue = pendingBalances[assetId];

              if (existingBalance) {
                // Actualizar balance existente (establecer directamente, no sumar)
                console.log(
                  `[DEBUG] Actualizando balance existente a: ${balanceValue}`,
                );
                await tx.clientBalance.update({
                  where: {
                    clientId_assetId: {
                      clientId: updatedParentTransaction.clientId,
                      assetId,
                    },
                  },
                  data: {
                    balance: balanceValue,
                    transactionId: parentId,
                  },
                });
              } else if (balanceValue !== 0) {
                // Solo crear un nuevo balance si no es cero
                console.log(
                  `[DEBUG] Creando nuevo balance con valor: ${balanceValue} para assetId: ${assetId}`,
                );
                await tx.clientBalance.create({
                  data: {
                    clientId: updatedParentTransaction.clientId,
                    assetId,
                    balance: balanceValue,
                    transactionId: parentId,
                  },
                });
              }

              // Actualizar también el balance del sistema (inverso al del cliente)
              const systemBalanceValue = -balanceValue; // El sistema tiene el balance inverso
              const existingSystemBalance = await tx.clientBalance.findUnique({
                where: {
                  clientId_assetId: {
                    clientId: systemClient.id,
                    assetId,
                  },
                },
              });

              if (existingSystemBalance) {
                console.log(
                  `[DEBUG] Actualizando balance del sistema a: ${systemBalanceValue}`,
                );
                await tx.clientBalance.update({
                  where: {
                    clientId_assetId: {
                      clientId: systemClient.id,
                      assetId,
                    },
                  },
                  data: {
                    balance: existingSystemBalance.balance + systemBalanceValue, // Actualizamos el balance, no lo reemplazamos
                    transactionId: parentId,
                  },
                });
              } else if (systemBalanceValue !== 0) {
                // Solo crear un nuevo balance si no es cero
                console.log(
                  `[DEBUG] Creando nuevo balance del sistema con valor: ${systemBalanceValue} para assetId: ${assetId}`,
                );
                await tx.clientBalance.create({
                  data: {
                    clientId: systemClient.id,
                    assetId,
                    balance: systemBalanceValue, // Aquí sí se asigna directamente al crear
                    transactionId: parentId,
                  },
                });
              }
            } catch (error) {
              console.error(
                `[ERROR] Error al actualizar/crear balance para assetId ${assetId}:`,
                error,
              );
              continue; // Continuar con el siguiente en lugar de abortar todo
            }
          }

          // Si todos los detalles están cubiertos, marcar la transacción padre como completada
          if (allDetailsCovered) {
            try {
              console.log(`[DEBUG] Marcando transacción padre como COMPLETED`);
              await tx.transaction.update({
                where: { id: parentId },
                data: {
                  state: TransactionState.COMPLETED,
                  notes: `${updatedParentTransaction.notes || ''} | Completada mediante transacciones hijas`,
                },
              });

              // También marcar todas las transacciones hijas como COMPLETED
              console.log(
                `[DEBUG] Actualizando todas las transacciones hijas a COMPLETED`,
              );
              const childIds = childTransactions.map((child) => child.id);

              if (childIds.length > 0) {
                // Actualizar cada transacción hija individualmente para manejar correctamente las notas
                for (const childTransaction of childTransactions) {
                  if (
                    childTransaction.state === TransactionState.CURRENT_ACCOUNT
                  ) {
                    console.log(
                      `[DEBUG] Actualizando transacción hija ${childTransaction.id} a COMPLETED`,
                    );

                    await tx.transaction.update({
                      where: { id: childTransaction.id },
                      data: {
                        state: TransactionState.COMPLETED,
                        notes: `${childTransaction.notes || ''} | Actualizada a COMPLETED al completarse la transacción padre`,
                        updatedAt: new Date(),
                      },
                    });

                    // Registrar en el log de auditoría
                    await tx.auditLog.create({
                      data: {
                        entityType: 'Transaction',
                        entityId: childTransaction.id,
                        action:
                          'Actualización a COMPLETED al completarse la transacción padre',
                        changedData: {
                          previousState: TransactionState.CURRENT_ACCOUNT,
                          newState: TransactionState.COMPLETED,
                          parentTransactionId: parentId,
                        },
                        changedBy: userId,
                      },
                    });
                  }
                }
              }
            } catch (error) {
              console.error(`[ERROR] Error al marcar como completada:`, error);
              throw error;
            }

            // Registrar cambio en log de auditoría
            try {
              console.log(`[DEBUG] Registrando log de completado`);
              await tx.auditLog.create({
                data: {
                  entityType: 'Transaction',
                  entityId: parentId,
                  action:
                    'Actualización a COMPLETED por cobertura total con hijas',
                  changedData: {
                    previousState: TransactionState.CURRENT_ACCOUNT,
                    newState: TransactionState.COMPLETED,
                  },
                  changedBy: userId,
                },
              });
            } catch (error) {
              console.error(
                `[ERROR] Error al crear log de auditoría de completado:`,
                error,
              );
              throw error;
            }
          }

          console.log(`[DEBUG] Operación completada exitosamente`);
          return childTransactionData;
        },
        {
          timeout: 30000,
        },
      );
    } catch (error) {
      console.error(`[ERROR] Error general en createChildTransaction:`, error);
      throw new BadRequestException(
        `Error al crear la transacción hija: ${error.message}`,
      );
    }
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
            // Para el balance del cliente:
            // - Si el cliente ENTREGA (INCOME), debe DISMINUIR su deuda, por lo tanto su balance DISMINUYE (valor negativo)
            // - Si el cliente RECIBE (EXPENSE), debe AUMENTAR su deuda, por lo tanto su balance AUMENTA (valor positivo)
            const amountChange =
              detail.movementType === MovementType.INCOME
                ? -detail.amount // Cliente entrega, su deuda disminuye (balance disminuye)
                : detail.amount; // Cliente recibe, su deuda aumenta (balance aumenta)

            acc[detail.assetId] = (acc[detail.assetId] || 0) + amountChange;
            return acc;
          },
          {} as Record<string, number>,
        );

        // Calcular actualizaciones de balance para el sistema (inverso al cliente)
        const systemBalanceUpdates = Object.entries(balanceUpdates).reduce(
          (acc, [assetId, amount]) => {
            // Para el balance del sistema:
            // - Si el cliente ENTREGA (INCOME), el sistema RECIBE, por lo tanto el balance del sistema AUMENTA
            // - Si el cliente RECIBE (EXPENSE), el sistema ENTREGA, por lo tanto el balance del sistema DISMINUYE
            acc[assetId] = -1 * Number(amount); // El sistema tiene el efecto opuesto al cliente
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
            assetId: { in: Object.keys(systemBalanceUpdates) },
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
                  existingClientBalance.balance + balanceUpdates[assetId],
                transactionId: initialTransaction.id,
              },
            });
          } else {
            await tx.clientBalance.create({
              data: {
                clientId: createPartialTransactionDto.clientId,
                assetId: assetId,
                balance: balanceUpdates[assetId],
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
                  existingSystemBalance.balance + systemBalanceUpdates[assetId], // Usar systemBalanceUpdates en lugar de -balanceUpdates
                transactionId: initialTransaction.id,
              },
            });
          } else {
            await tx.clientBalance.create({
              data: {
                clientId: systemClient.id,
                assetId: assetId,
                balance: systemBalanceUpdates[assetId], // Usar systemBalanceUpdates en lugar de -balanceUpdates
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
            // Para el balance del cliente:
            // - Si el cliente ENTREGA (INCOME), debe DISMINUIR su deuda, por lo tanto su balance DISMINUYE (valor negativo)
            // - Si el cliente RECIBE (EXPENSE), debe AUMENTAR su deuda, por lo tanto su balance AUMENTA (valor positivo)
            const amountChange =
              detail.movementType === MovementType.INCOME
                ? -detail.amount // Cliente entrega, su deuda disminuye (balance disminuye)
                : detail.amount; // Cliente recibe, su deuda aumenta (balance aumenta)

            acc[detail.assetId] = (acc[detail.assetId] || 0) + amountChange;
            return acc;
          },
          {} as Record<string, number>,
        );

        // Calcular actualizaciones de balance para el sistema (inverso al cliente)
        const systemBalanceUpdates = Object.entries(balanceUpdates).reduce(
          (acc, [assetId, amount]) => {
            // Para el balance del sistema:
            // - Si el cliente ENTREGA (INCOME), el sistema RECIBE, por lo tanto el balance del sistema AUMENTA
            // - Si el cliente RECIBE (EXPENSE), el sistema ENTREGA, por lo tanto el balance del sistema DISMINUYE
            acc[assetId] = -1 * Number(amount); // El sistema tiene el efecto opuesto al cliente
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
            assetId: { in: Object.keys(systemBalanceUpdates) },
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
                  existingClientBalance.balance + balanceUpdates[assetId],
                transactionId: id,
              },
            });
          } else {
            await tx.clientBalance.create({
              data: {
                clientId: transaction.clientId,
                assetId: assetId,
                balance: balanceUpdates[assetId],
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
                  existingSystemBalance.balance + systemBalanceUpdates[assetId],
                transactionId: id,
              },
            });
          } else {
            await tx.clientBalance.create({
              data: {
                clientId: systemClient.id,
                assetId: assetId,
                balance: systemBalanceUpdates[assetId],
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
      // En lugar de usar TransactionState.CANCELLED, usamos un string directo
      // que corresponda al valor en la base de datos
      await this.prisma.$executeRaw`
        UPDATE "Transaction"
        SET "state" = 'COMPLETED', "notes" = CONCAT(COALESCE("notes", ''), ' [CANCELADA]'), "updatedAt" = NOW(), "createdBy" = ${userId}
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

  /**
   * Concilia fondos entre clientes, tomando un saldo positivo de un cliente y
   * distribuyéndolo para saldar deudas con otros clientes.
   *
   * La conciliación NO afecta al balance del sistema, solo redistribuye deudas entre clientes.
   * - Si el Cliente A debe 100 USD al sistema (balance +100)
   * - Y el sistema debe 100 USD al Cliente B (balance -100)
   * - La conciliación transfiere la deuda, dejando ambos clientes con balance 0
   * - El sistema mantiene su inventario real de activos sin cambios
   */
  async reconcile(
    reconciliationDto: CreateReconciliationDto,
    userId: string,
  ): Promise<any> {
    try {
      return this.prisma.$transaction(
        async (tx) => {
          // 1. Verificar que la transacción origen existe
          const sourceTransaction = await tx.transaction.findUnique({
            where: { id: reconciliationDto.sourceTransactionId },
            include: {
              client: true,
              clientBalances: {
                where: { assetId: reconciliationDto.sourceAssetId },
              },
            },
          });

          if (!sourceTransaction) {
            throw new NotFoundException(
              `Transacción origen con ID ${reconciliationDto.sourceTransactionId} no encontrada`,
            );
          }

          // 2. Verificar que el cliente de la transacción origen tiene saldo suficiente
          const sourceClientBalance = sourceTransaction.clientBalances.find(
            (b) => b.assetId === reconciliationDto.sourceAssetId,
          );

          if (!sourceClientBalance) {
            throw new BadRequestException(
              `El cliente no tiene saldo en el activo especificado`,
            );
          }

          // El balance positivo indica que el cliente debe dinero a la casa de cambio
          // Por lo tanto, este saldo positivo puede destinarse a otros clientes
          if (sourceClientBalance.balance <= 0) {
            throw new BadRequestException(
              `El cliente no tiene saldo positivo disponible para conciliar`,
            );
          }

          // 3. Sumar el total de conciliaciones solicitadas
          const totalReconciliationAmount = reconciliationDto.targets.reduce(
            (sum, target) => sum + target.amount,
            0,
          );

          // 4. Verificar que no excede el saldo disponible
          if (totalReconciliationAmount > sourceClientBalance.balance) {
            throw new BadRequestException(
              `El monto total a conciliar (${totalReconciliationAmount}) excede el saldo disponible (${sourceClientBalance.balance})`,
            );
          }

          // 5. Obtener el cliente sistema
          const systemClient = await tx.client.findFirst({
            where: { name: 'Casa de Cambio (Sistema)' },
          });

          if (!systemClient) {
            throw new NotFoundException('Cliente sistema no encontrado');
          }

          // 6. Procesar cada transacción destino
          const reconciliations = [];
          for (const target of reconciliationDto.targets) {
            // Verificar que el cliente destino existe
            const targetClient = await tx.client.findUnique({
              where: { id: target.clientId },
            });

            if (!targetClient) {
              throw new NotFoundException(
                `Cliente destino con ID ${target.clientId} no encontrado`,
              );
            }

            // Verificar que el activo coincide con el origen o es el solicitado
            if (target.assetId !== reconciliationDto.sourceAssetId) {
              throw new BadRequestException(
                `El activo del destino debe coincidir con el activo de origen`,
              );
            }

            // Buscar el balance del cliente destino
            const targetClientBalance = await tx.clientBalance.findUnique({
              where: {
                clientId_assetId: {
                  clientId: target.clientId,
                  assetId: target.assetId,
                },
              },
            });

            // Verificar que el cliente destino tiene un balance negativo (la casa de cambio le debe)
            if (!targetClientBalance || targetClientBalance.balance >= 0) {
              throw new BadRequestException(
                `El cliente destino no tiene saldo negativo para conciliar en este activo`,
              );
            }

            // Verificar que no intentamos conciliar más de lo que debemos
            const targetNegativeBalance = Math.abs(targetClientBalance.balance); // Convertir a positivo para comparar
            if (target.amount > targetNegativeBalance) {
              throw new BadRequestException(
                `El monto a conciliar (${target.amount}) excede la deuda con el cliente destino (${targetNegativeBalance})`,
              );
            }

            // Crear una nueva transacción para registrar la conciliación
            const targetTransaction = await tx.transaction.create({
              data: {
                clientId: target.clientId,
                date: new Date(),
                state: TransactionState.COMPLETED,
                notes: `Conciliación de saldo: ${target.notes || ''} (Origen: Cliente ${sourceTransaction.client.name}, ID: ${sourceTransaction.id})`,
                createdBy: userId,
              },
            });

            // Crear el detalle de la transacción
            await tx.transactionDetail.create({
              data: {
                transactionId: targetTransaction.id,
                assetId: target.assetId,
                movementType: MovementType.EXPENSE, // El cliente recibe fondos
                amount: target.amount,
                notes: `Conciliación de saldo desde cliente ${sourceTransaction.client.name}`,
                createdBy: userId,
              },
            });

            // Actualizar el balance del cliente destino
            await tx.clientBalance.update({
              where: {
                clientId_assetId: {
                  clientId: target.clientId,
                  assetId: target.assetId,
                },
              },
              data: {
                balance: targetClientBalance.balance + target.amount, // El balance negativo se acerca a cero
                transactionId: targetTransaction.id,
              },
            });

            // Registrar la conciliación
            const reconciliation = await tx.reconciliation.create({
              data: {
                sourceTransactionId: reconciliationDto.sourceTransactionId,
                targetTransactionId: targetTransaction.id,
                amount: target.amount,
                notes: reconciliationDto.notes || 'Conciliación de saldos',
                createdBy: userId,
              },
            });

            reconciliations.push(reconciliation);
          }

          // 7. Actualizar el balance del cliente origen
          await tx.clientBalance.update({
            where: {
              clientId_assetId: {
                clientId: sourceTransaction.clientId,
                assetId: reconciliationDto.sourceAssetId,
              },
            },
            data: {
              balance: sourceClientBalance.balance - totalReconciliationAmount,
              transactionId: sourceTransaction.id,
            },
          });

          // Actualizar el balance del sistema para el activo origen
          const systemSourceBalance = await tx.clientBalance.findUnique({
            where: {
              clientId_assetId: {
                clientId: systemClient.id,
                assetId: reconciliationDto.sourceAssetId,
              },
            },
          });

          if (systemSourceBalance) {
            // Restamos del sistema lo que entregamos al cliente
            await tx.clientBalance.update({
              where: {
                clientId_assetId: {
                  clientId: systemClient.id,
                  assetId: reconciliationDto.sourceAssetId,
                },
              },
              data: {
                // Restamos la cantidad entregada
                balance:
                  systemSourceBalance.balance - totalReconciliationAmount,
                transactionId: sourceTransaction.id,
              },
            });
          }

          // Revisamos si alguno de los targets tiene un activo diferente
          // Si lo tiene, debemos actualizar el balance del sistema para ese activo
          for (const target of reconciliationDto.targets) {
            if (target.assetId !== reconciliationDto.sourceAssetId) {
              const systemTargetBalance = await tx.clientBalance.findUnique({
                where: {
                  clientId_assetId: {
                    clientId: systemClient.id,
                    assetId: target.assetId,
                  },
                },
              });

              if (systemTargetBalance) {
                // Buscamos la transacción relacionada con este target
                const targetTransaction = reconciliations.find(
                  (r) =>
                    r.targetClientId === target.clientId &&
                    r.targetAssetId === target.assetId,
                );

                await tx.clientBalance.update({
                  where: {
                    clientId_assetId: {
                      clientId: systemClient.id,
                      assetId: target.assetId,
                    },
                  },
                  data: {
                    // Sumamos la cantidad recibida
                    balance: systemTargetBalance.balance + target.amount,
                    transactionId: targetTransaction
                      ? targetTransaction.id
                      : sourceTransaction.id,
                  },
                });
              }
            }
          }

          // 9. Registrar en el log de auditoría
          await tx.auditLog.create({
            data: {
              entityType: 'Reconciliation',
              entityId: reconciliations[0].id, // Usamos el ID de la primera conciliación
              action: 'Conciliación de saldos',
              changedData: {
                sourceTransactionId: reconciliationDto.sourceTransactionId,
                sourceAssetId: reconciliationDto.sourceAssetId,
                totalAmount: totalReconciliationAmount,
                targetCount: reconciliationDto.targets.length,
              },
              changedBy: userId,
            },
          });

          // 10. Retornar las conciliaciones creadas
          return {
            reconciliations,
            totalAmount: totalReconciliationAmount,
            sourceTransaction: {
              id: sourceTransaction.id,
              client: sourceTransaction.client,
              previousBalance: sourceClientBalance.balance,
              newBalance:
                sourceClientBalance.balance - totalReconciliationAmount,
            },
          };
        },
        {
          timeout: 15000,
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      console.error('Error en reconcile:', error);
      throw new BadRequestException(
        `Error al conciliar transacciones: ${error.message}`,
      );
    }
  }

  /**
   * Busca clientes con balances negativos (a los que se les debe) en un activo específico
   * para posibles conciliaciones
   */
  async findClientsForReconciliation(
    findClientsDto: FindClientsForReconciliationDto,
  ): Promise<any> {
    try {
      // Buscar todos los clientes con balance negativo en el activo especificado
      const clientsWithNegativeBalance = await this.prisma.$queryRaw<any[]>`
        SELECT cb.id, cb."clientId", cb."assetId", cb.balance,
               c.name as "clientName", c.email as "clientEmail", c.phone as "clientPhone",
               a.name as "assetName", a.description as "assetSymbol"
        FROM "ClientBalance" cb
        JOIN "Client" c ON cb."clientId" = c.id
        JOIN "Asset" a ON cb."assetId" = a.id
        WHERE cb."assetId" = ${findClientsDto.assetId}
          AND cb.balance < 0
        ORDER BY cb.balance ASC
      `;

      // Buscar todos los clientes con balance positivo en el activo especificado
      const clientsWithPositiveBalance = await this.prisma.$queryRaw<any[]>`
        SELECT cb.id, cb."clientId", cb."assetId", cb.balance,
               c.name as "clientName", c.email as "clientEmail", c.phone as "clientPhone",
               a.name as "assetName", a.description as "assetSymbol"
        FROM "ClientBalance" cb
        JOIN "Client" c ON cb."clientId" = c.id
        JOIN "Asset" a ON cb."assetId" = a.id
        WHERE cb."assetId" = ${findClientsDto.assetId}
          AND cb.balance > 0
        ORDER BY cb.balance DESC
      `;

      // Obtener información del activo
      const asset = await this.prisma.asset.findUnique({
        where: { id: findClientsDto.assetId },
        select: {
          id: true,
          name: true,
        },
      });

      return {
        clientsThatWeOwe: clientsWithNegativeBalance.map((balance) => ({
          clientId: balance.clientId,
          assetId: balance.assetId,
          balance: Number(balance.balance),
          absBalance: Math.abs(Number(balance.balance)), // Valor absoluto para facilitar la UI
          clientName: balance.clientName,
          clientEmail: balance.clientEmail,
          clientPhone: balance.clientPhone,
          assetName: balance.assetName,
          assetSymbol: balance.assetSymbol,
        })),
        clientsThatOweUs: clientsWithPositiveBalance.map((balance) => ({
          clientId: balance.clientId,
          assetId: balance.assetId,
          balance: Number(balance.balance),
          clientName: balance.clientName,
          clientEmail: balance.clientEmail,
          clientPhone: balance.clientPhone,
          assetName: balance.assetName,
          assetSymbol: balance.assetSymbol,
        })),
        asset,
      };
    } catch (error) {
      console.error('Error en findClientsForReconciliation:', error);
      throw new BadRequestException(
        `Error al buscar clientes para conciliación: ${error.message}`,
      );
    }
  }

  async conciliateImmutableAssets(
    dto: ConciliateImmutableAssetsDto,
    userId: string,
  ): Promise<any> {
    try {
      return this.prisma.$transaction(
        async (tx) => {
          // 1. Calcular el balance neto y los totales de entrada/salida
          let incomingTotal = 0;
          let outgoingTotal = 0;

          dto.clientTransactions.forEach((transaction) => {
            if (transaction.movementType === MovementType.INCOME) {
              incomingTotal += transaction.amount;
            } else {
              outgoingTotal += transaction.amount;
            }
          });

          // Registrar los totales pero sin validación, ya que pueden ser diferentes
          console.log(
            `Total INCOME: ${incomingTotal}, Total EXPENSE: ${outgoingTotal}`,
          );

          // 2. Verificar que todos los activos son inmutables
          const assetIds = [
            ...new Set(dto.clientTransactions.map((t) => t.assetId)),
          ];

          const assets = await tx.asset.findMany({
            where: {
              id: {
                in: assetIds,
              },
            },
          });

          // Verificar que existen todos los activos solicitados
          if (assets.length !== assetIds.length) {
            const foundIds = assets.map((a) => a.id);
            const missingIds = assetIds.filter((id) => !foundIds.includes(id));
            throw new NotFoundException(
              `No se encontraron los activos con IDs: ${missingIds.join(', ')}`,
            );
          }

          // Verificar que todos son inmutables
          const nonImmutableAssets = assets.filter((a) => !a.isImmutable);
          if (nonImmutableAssets.length > 0) {
            throw new BadRequestException(
              `Los siguientes activos no son inmutables: ${nonImmutableAssets
                .map((a) => a.name)
                .join(
                  ', ',
                )}. Esta operación solo es válida para activos inmutables.`,
            );
          }

          // 4. Verificar que existen todos los clientes
          const clientIds = [
            ...new Set(dto.clientTransactions.map((t) => t.clientId)),
          ];

          const clients = await tx.client.findMany({
            where: {
              id: {
                in: clientIds,
              },
            },
          });

          // Verificar que existen todos los clientes solicitados
          if (clients.length !== clientIds.length) {
            const foundIds = clients.map((c) => c.id);
            const missingIds = clientIds.filter((id) => !foundIds.includes(id));
            throw new NotFoundException(
              `No se encontraron los clientes con IDs: ${missingIds.join(', ')}`,
            );
          }

          // 5. Crear transacciones para cada cliente
          const transactions = [];

          for (const clientTransaction of dto.clientTransactions) {
            const client = clients.find(
              (c) => c.id === clientTransaction.clientId,
            );
            const asset = assets.find(
              (a) => a.id === clientTransaction.assetId,
            );

            // Crear la transacción para este cliente
            const transaction = await tx.transaction.create({
              data: {
                clientId: clientTransaction.clientId,
                date: new Date(),
                state: TransactionState.COMPLETED, // Marcar como completada automáticamente
                notes:
                  clientTransaction.notes ||
                  `Operación con activo inmutable: ${asset.name}`,
                createdBy: userId,
              },
            });

            // Crear el detalle de la transacción
            const transactionDetail = await tx.transactionDetail.create({
              data: {
                transactionId: transaction.id,
                assetId: clientTransaction.assetId,
                movementType: clientTransaction.movementType,
                amount: clientTransaction.amount,
                notes: `Pase de mano con ${asset.name}`,
                createdBy: userId,
              },
            });

            transactions.push({
              transaction,
              detail: transactionDetail,
              client,
              asset,
            });
          }

          // 6. Relacionar las transacciones entre sí
          // Si hay más de una transacción, las relacionamos
          if (transactions.length > 1) {
            // Tomamos la primera transacción como "principal" para relacionar las demás
            const mainTransaction = transactions[0].transaction;

            // Actualizamos las demás transacciones para que tengan como padre la transacción principal
            for (let i = 1; i < transactions.length; i++) {
              await tx.transaction.update({
                where: { id: transactions[i].transaction.id },
                data: {
                  parentTransactionId: mainTransaction.id,
                },
              });
            }
          }

          // 7. Registrar en el log de auditoría
          await tx.auditLog.create({
            data: {
              entityType: 'ImmutableAssetTransaction',
              entityId: transactions[0].transaction.id, // Usamos el ID de la primera transacción
              action: 'Pase de mano con activos inmutables',
              changedData: {
                incomingTotal,
                outgoingTotal,
                clientTransactions: dto.clientTransactions.map((t) => ({
                  clientId: t.clientId,
                  assetId: t.assetId,
                  assetName: assets.find((a) => a.id === t.assetId).name,
                  movementType: t.movementType,
                  amount: t.amount,
                })),
              },
              changedBy: userId,
            },
          });

          // 8. Retornar resultado
          return {
            incomingTotal,
            outgoingTotal,
            transactions: transactions.map((t) => ({
              id: t.transaction.id,
              client: {
                id: t.client.id,
                name: t.client.name,
              },
              asset: {
                id: t.asset.id,
                name: t.asset.name,
              },
              amount: t.detail.amount,
              movementType: t.detail.movementType,
            })),
          };
        },
        {
          timeout: 30000,
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      console.error('Error en conciliateImmutableAssets:', error);
      throw new BadRequestException(
        `Error al procesar transacción con activo inmutable: ${error.message}`,
      );
    }
  }

  async findOpenImmutableAssetTransactions(): Promise<any> {
    try {
      // Buscar los activos inmutables (cable traer, cable llevar) y cuentas madres
      const immutableAssets = await this.prisma.asset.findMany({
        where: {
          OR: [
            { isImmutable: true },
            { name: { contains: 'madre', mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          isImmutable: true,
        },
      });

      if (!immutableAssets.length) {
        return { transactions: [] };
      }

      const immutableAssetIds = immutableAssets.map((asset) => asset.id);

      // Buscar todas las transacciones abiertas relacionadas con estos activos
      const transactions = await this.prisma.transaction.findMany({
        where: {
          state: TransactionState.COMPLETED,
          details: {
            some: {
              assetId: {
                in: immutableAssetIds,
              },
            },
          },
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
            },
          },
          details: {
            include: {
              asset: {
                select: {
                  id: true,
                  name: true,
                  isImmutable: true,
                },
              },
              billDetails: true,
            },
          },
          createdByUser: {
            select: {
              id: true,
              username: true,
            },
          },
        },
        orderBy: {
          date: 'desc',
        },
      });

      return {
        transactions: transactions.map((tx) => ({
          ...tx,
          date: tx.date.toISOString(),
        })),
        immutableAssets,
      };
    } catch (error) {
      console.error('Error en findOpenImmutableAssetTransactions:', error);
      throw new BadRequestException(
        `Error al obtener transacciones de activos inmutables: ${error.message}`,
      );
    }
  }
}
