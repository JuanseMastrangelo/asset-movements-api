import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssetType, TransactionState } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene el stock total de todos los activos en el sistema
   * @returns Lista de activos con sus cantidades totales
   */
  async getTotalStock(): Promise<
    Array<{
      id: string;
      name: string;
      type: AssetType;
      totalAmount: number;
    }>
  > {
    // 1. Obtener todos los activos
    const assets = await this.prisma.asset.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        type: 'asc',
      },
    });

    // 2. Buscar el cliente del sistema por su email
    const systemClient = await this.prisma.client.findFirst({
      where: {
        email: 'sistema@casacambio.com',
      },
    });

    if (!systemClient) {
      throw new NotFoundException('Cliente sistema no encontrado');
    }

    // 3. Obtener los balances del sistema para estos activos
    const systemBalances = await this.prisma.clientBalance.findMany({
      where: {
        clientId: systemClient.id,
      },
    });

    // 4. Mapear los activos con sus cantidades
    return assets.map((asset) => {
      const balance = systemBalances.find(
        (balance) => balance.assetId === asset.id,
      );

      return {
        id: asset.id,
        name: asset.name,
        type: asset.type,
        totalAmount: balance?.balance || 0,
      };
    });
  }

  /**
   * Obtiene el total de las cuentas corrientes (balances de clientes) agrupados por activo
   * @returns Lista de activos con el total de balances de clientes
   */
  async getTotalCurrentAccounts(): Promise<
    Array<{
      id: string;
      name: string;
      type: AssetType;
      totalAmount: number;
    }>
  > {
    // 1. Obtener todos los activos
    const assets = await this.prisma.asset.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        type: 'asc',
      },
    });

    // 2. Buscar el cliente del sistema por su email
    const systemClient = await this.prisma.client.findFirst({
      where: {
        email: 'sistema@casacambio.com',
      },
    });

    if (!systemClient) {
      throw new NotFoundException('Cliente sistema no encontrado');
    }

    // 3. Calcular el total de balances por activo
    const result: Array<{
      id: string;
      name: string;
      type: AssetType;
      totalAmount: number;
    }> = [];

    for (const asset of assets) {
      // Sumar todos los balances de clientes para este activo
      const totalBalance = await this.prisma.clientBalance.aggregate({
        _sum: {
          balance: true,
        },
        where: {
          assetId: asset.id,
          clientId: {
            not: systemClient.id, // Excluir al cliente del sistema
          },
        },
      });

      result.push({
        id: asset.id,
        name: asset.name,
        type: asset.type,
        totalAmount: totalBalance._sum.balance || 0,
      });
    }

    return result;
  }

  /**
   * Obtiene la lista de transacciones pendientes agrupadas por cliente con los totales por activo
   * @returns Lista de tareas pendientes con sus detalles
   */
  async getPendingTasks() {
    // 1. Obtener todos los activos activos para usarlos como columnas
    const assets = await this.prisma.asset.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
    });

    // 2. Obtener todas las transacciones pendientes con sus detalles
    const pendingTransactions = await this.prisma.transaction.findMany({
      where: {
        state: TransactionState.PENDING,
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
            asset: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 3. Agrupar las transacciones por cliente y calcular totales por activo
    const clientGroups: Record<
      string,
      {
        clientId: string;
        clientName: string;
        transactions: Array<{
          id: string;
          date: Date;
          notes: string | null;
          state: TransactionState;
        }>;
        assetTotals: Record<string, number>;
      }
    > = {};

    const totals: Record<string, number> = {};

    // Inicializar totales en 0 para cada activo
    assets.forEach((asset) => {
      totals[asset.id] = 0;
    });

    // Procesar cada transacción
    pendingTransactions.forEach((transaction) => {
      const clientId = transaction.client.id;

      // Si el cliente no existe en el grupo, inicializarlo
      if (!clientGroups[clientId]) {
        clientGroups[clientId] = {
          clientId,
          clientName: transaction.client.name,
          transactions: [],
          assetTotals: {},
        };

        // Inicializar totales en 0 para cada activo
        assets.forEach((asset) => {
          clientGroups[clientId].assetTotals[asset.id] = 0;
        });
      }

      // Añadir la transacción a la lista del cliente
      clientGroups[clientId].transactions.push({
        id: transaction.id,
        date: transaction.date,
        notes: transaction.notes,
        state: transaction.state,
      });

      // Calcular totales por activo para esta transacción
      transaction.details.forEach((detail) => {
        const assetId = detail.asset.id;
        const amount =
          detail.movementType === 'INCOME' ? detail.amount : -detail.amount;

        // Actualizar totales del cliente
        clientGroups[clientId].assetTotals[assetId] =
          (clientGroups[clientId].assetTotals[assetId] || 0) + amount;

        // Actualizar totales generales
        totals[assetId] = (totals[assetId] || 0) + amount;
      });
    });

    // 4. Formatear la respuesta
    return {
      clients: Object.values(clientGroups),
      assets: assets,
      totals: totals,
    };
  }

  /**
   * Obtiene la lista de balances de clientes agrupados por cliente y activo
   * @returns Lista de clientes con sus balances por activo
   */
  async getClientCurrentAccounts() {
    // 1. Buscar el cliente del sistema por su email
    const systemClient = await this.prisma.client.findFirst({
      where: {
        email: 'sistema@casacambio.com',
      },
    });

    if (!systemClient) {
      throw new NotFoundException('Cliente sistema no encontrado');
    }

    // 2. Obtener todos los activos activos para usarlos como columnas
    const assets = await this.prisma.asset.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
    });

    // 3. Obtener todos los clientes activos con sus balances
    const clients = await this.prisma.client.findMany({
      where: {
        isActive: true,
        id: {
          not: systemClient.id, // Excluir al cliente del sistema
        },
      },
      include: {
        ClientBalance: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // 4. Formatear la respuesta
    const formattedClients = clients.map((client) => {
      const balances: Record<string, number> = {};

      // Inicializar todos los balances en 0
      assets.forEach((asset) => {
        balances[asset.id] = 0;
      });

      // Asignar los balances existentes
      client.ClientBalance.forEach((balance) => {
        balances[balance.assetId] = balance.balance;
      });

      return {
        clientId: client.id,
        clientName: client.name,
        balances: balances,
      };
    });

    return {
      clients: formattedClients,
      assets: assets,
    };
  }

  /**
   * Obtiene el historial de transacciones recientes
   * @param limit Número máximo de transacciones a retornar
   * @returns Lista de transacciones con información básica
   */
  async getTransactionHistory(limit = 20) {
    const transactions = await this.prisma.transaction.findMany({
      take: limit,
      orderBy: {
        date: 'desc',
      },
      include: {
        client: true,
        childTransactions: {
          include: {
            client: true,
          },
        },
      },
    });

    // Obtener las transacciones padre para aquellas que tengan parentTransactionId
    const parentIds = transactions
      .filter((t) => t.parentTransactionId)
      .map((t) => t.parentTransactionId);

    let parentTransactions: Array<any> = [];
    if (parentIds.length > 0) {
      parentTransactions = await this.prisma.transaction.findMany({
        where: {
          id: {
            in: parentIds,
          },
        },
        include: {
          client: true,
        },
      });
    }

    // Formatear la respuesta
    return transactions.map((transaction) => {
      const parent = transaction.parentTransactionId
        ? parentTransactions.find(
            (p) => p.id === transaction.parentTransactionId,
          )
        : null;

      return {
        id: transaction.id,
        date: transaction.date,
        state: transaction.state,
        notes: transaction.notes,
        clientId: transaction.client.id,
        clientName: transaction.client.name,
        parentTransactionId: transaction.parentTransactionId,
        parentClientName: parent?.client?.name || null,
      };
    });
  }

  /**
   * Obtiene los balances del sistema (cliente sistema)
   * @returns Los balances del sistema agrupados por activo
   */
  async getSystemBalance() {
    // Obtener el cliente sistema
    const systemClient = await this.prisma.client.findFirst({
      where: { name: 'Casa de Cambio (Sistema)' },
    });

    if (!systemClient) {
      throw new NotFoundException('Cliente sistema no encontrado');
    }

    // Obtener todos los activos activos
    const assets = await this.prisma.asset.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
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

  /**
   * Obtiene el balance de un cliente específico para todos sus activos
   * @param clientId ID del cliente a consultar
   * @returns Datos del cliente con sus balances por activo
   */
  async getClientBalance(clientId: string) {
    // 1. Verificar que el cliente existe
    const client = await this.prisma.client.findUnique({
      where: {
        id: clientId,
        isActive: true,
      },
    });

    if (!client) {
      throw new NotFoundException(
        `Cliente con ID ${clientId} no encontrado o inactivo`,
      );
    }

    // 2. Obtener los balances del cliente
    const clientBalances = await this.prisma.clientBalance.findMany({
      where: {
        clientId: clientId,
      },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            description: true,
            type: true,
          },
        },
      },
      orderBy: {
        asset: {
          type: 'asc',
        },
      },
    });

    // 3. Obtener todos los activos para incluir también los que tienen balance 0
    const allAssets = await this.prisma.asset.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
      },
      orderBy: {
        type: 'asc',
      },
    });

    // 4. Crear un array con todos los activos y sus balances (incluyendo los que tienen 0)
    const balances = allAssets.map((asset) => {
      const existingBalance = clientBalances.find(
        (balance) => balance.assetId === asset.id,
      );

      return {
        asset: asset,
        balance: existingBalance?.balance || 0,
      };
    });

    // 5. Formatear la respuesta
    return {
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
      },
      balances: balances,
    };
  }
}
