import {
  PrismaClient,
  UserRole,
  MovementType,
  TransactionState,
} from '@prisma/client';

const prisma = new PrismaClient();

async function generateTestData() {
  try {
    console.log('Generando datos de prueba...');

    // Obtener cliente sistema
    const systemClient = await prisma.client.findFirst({
      where: {
        name: 'Casa de Cambio (Sistema)',
      },
    });

    if (!systemClient) {
      throw new Error(
        'No se encontró el cliente sistema. Ejecuta primero el script initialize-db.ts',
      );
    }

    console.log(`Cliente sistema encontrado con ID: ${systemClient.id}`);
    const systemClientId = systemClient.id;

    // 1. Crear algunos clientes de prueba
    const clients = await Promise.all([
      prisma.client.create({
        data: {
          name: 'Empresa Importadora S.A.',
          email: 'contacto@importadora.com',
          phone: '+123456789',
          address: 'Av. Comercio 123',
          country: 'Argentina',
          isActive: true,
        },
      }),
      prisma.client.create({
        data: {
          name: 'Juan Pérez',
          email: 'juan.perez@gmail.com',
          phone: '+987654321',
          address: 'Calle Principal 456',
          country: 'Argentina',
          isActive: true,
        },
      }),
      prisma.client.create({
        data: {
          name: 'Distribuidora Internacional',
          email: 'info@distribuidora.com',
          phone: '+111222333',
          address: 'Ruta 7 Km 15',
          country: 'Argentina',
          isActive: true,
        },
      }),
    ]);

    console.log(`✅ Creados ${clients.length} clientes de prueba:`);
    clients.forEach((client) => {
      console.log(`- ${client.name} (ID: ${client.id})`);
    });

    // 2. Obtener activos existentes
    const assets = await prisma.asset.findMany({
      where: { isActive: true },
    });

    if (assets.length === 0) {
      throw new Error(
        'No se encontraron activos. Ejecuta primero el script initialize-db.ts',
      );
    }

    // Crear mapeo para facilitar el acceso a los activos por nombre
    const assetMap = assets.reduce(
      (map, asset) => {
        map[asset.name] = asset;
        return map;
      },
      {} as Record<string, any>,
    );

    // 3. Obtener el ID del usuario administrador
    const adminUser = await prisma.user.findFirst({
      where: { role: UserRole.SUPER_ADMIN },
    });

    if (!adminUser) {
      throw new Error(
        'No se encontró un usuario administrador. Ejecuta primero el script initialize-db.ts',
      );
    }

    // 4. Crear algunas transacciones de prueba

    // Cliente 1: Transacción simple completada (venta de dólares)
    const transaction1 = await prisma.transaction.create({
      data: {
        clientId: clients[0].id,
        date: new Date(),
        state: TransactionState.COMPLETED,
        notes: 'Venta de dólares a Empresa Importadora',
        createdBy: adminUser.id,
      },
    });

    // Crear detalles de la transacción
    await prisma.transactionDetail.createMany({
      data: [
        {
          transactionId: transaction1.id,
          assetId: assetMap['Dólar Estadounidense'].id,
          movementType: MovementType.EXPENSE,
          amount: 5000,
          notes: 'Entrega de dólares al cliente',
          createdBy: adminUser.id,
        },
        {
          transactionId: transaction1.id,
          assetId: assetMap['Peso Argentino'].id,
          movementType: MovementType.INCOME,
          amount: 4500000, // 900 x 5000
          notes: 'Recepción de pesos',
          createdBy: adminUser.id,
        },
        {
          transactionId: transaction1.id,
          assetId: assetMap['Comisión'].id,
          movementType: MovementType.INCOME,
          amount: 50,
          percentageDifference: 1.0,
          notes: 'Comisión por cambio',
          createdBy: adminUser.id,
        },
      ],
    });

    // Actualizar balances
    await Promise.all([
      // Cliente recibe 5000 USD
      prisma.clientBalance.upsert({
        where: {
          clientId_assetId: {
            clientId: clients[0].id,
            assetId: assetMap['Dólar Estadounidense'].id,
          },
        },
        create: {
          clientId: clients[0].id,
          assetId: assetMap['Dólar Estadounidense'].id,
          balance: 5000,
          transactionId: transaction1.id,
        },
        update: {
          balance: {
            increment: 5000,
          },
          transactionId: transaction1.id,
        },
      }),
      // Cliente entrega 4500000 ARS
      prisma.clientBalance.upsert({
        where: {
          clientId_assetId: {
            clientId: clients[0].id,
            assetId: assetMap['Peso Argentino'].id,
          },
        },
        create: {
          clientId: clients[0].id,
          assetId: assetMap['Peso Argentino'].id,
          balance: -4500000,
          transactionId: transaction1.id,
        },
        update: {
          balance: {
            decrement: 4500000,
          },
          transactionId: transaction1.id,
        },
      }),
      // Sistema entrega 5000 USD
      prisma.clientBalance.upsert({
        where: {
          clientId_assetId: {
            clientId: systemClientId,
            assetId: assetMap['Dólar Estadounidense'].id,
          },
        },
        create: {
          clientId: systemClientId,
          assetId: assetMap['Dólar Estadounidense'].id,
          balance: -5000,
          transactionId: transaction1.id,
        },
        update: {
          balance: {
            decrement: 5000,
          },
          transactionId: transaction1.id,
        },
      }),
      // Sistema recibe 4500000 ARS
      prisma.clientBalance.upsert({
        where: {
          clientId_assetId: {
            clientId: systemClientId,
            assetId: assetMap['Peso Argentino'].id,
          },
        },
        create: {
          clientId: systemClientId,
          assetId: assetMap['Peso Argentino'].id,
          balance: 4500000,
          transactionId: transaction1.id,
        },
        update: {
          balance: {
            increment: 4500000,
          },
          transactionId: transaction1.id,
        },
      }),
    ]);

    // Cliente 2: Transacción en cuenta corriente (compra parcial de euros)
    const transaction2 = await prisma.transaction.create({
      data: {
        clientId: clients[1].id,
        date: new Date(),
        state: TransactionState.CURRENT_ACCOUNT,
        notes: 'Compra de euros por Juan Pérez - Entrega parcial',
        createdBy: adminUser.id,
      },
    });

    // Crear detalles de la transacción
    await prisma.transactionDetail.createMany({
      data: [
        {
          transactionId: transaction2.id,
          assetId: assetMap['Euro'].id,
          movementType: MovementType.INCOME,
          amount: 3000,
          notes: 'Recepción de euros',
          createdBy: adminUser.id,
        },
        {
          transactionId: transaction2.id,
          assetId: assetMap['Peso Argentino'].id,
          movementType: MovementType.EXPENSE,
          amount: 3000000, // 1000 x 3000
          notes: 'Entrega de pesos - Parcial',
          createdBy: adminUser.id,
        },
      ],
    });

    // Actualizar balances
    await Promise.all([
      // Cliente entrega 3000 EUR
      prisma.clientBalance.upsert({
        where: {
          clientId_assetId: {
            clientId: clients[1].id,
            assetId: assetMap['Euro'].id,
          },
        },
        create: {
          clientId: clients[1].id,
          assetId: assetMap['Euro'].id,
          balance: -3000,
          transactionId: transaction2.id,
        },
        update: {
          balance: {
            decrement: 3000,
          },
          transactionId: transaction2.id,
        },
      }),
      // Cliente solo recibe 3000000 ARS (de un total de 3600000)
      prisma.clientBalance.upsert({
        where: {
          clientId_assetId: {
            clientId: clients[1].id,
            assetId: assetMap['Peso Argentino'].id,
          },
        },
        create: {
          clientId: clients[1].id,
          assetId: assetMap['Peso Argentino'].id,
          balance: 3000000,
          transactionId: transaction2.id,
        },
        update: {
          balance: {
            increment: 3000000,
          },
          transactionId: transaction2.id,
        },
      }),
      // Sistema recibe 3000 EUR
      prisma.clientBalance.upsert({
        where: {
          clientId_assetId: {
            clientId: systemClientId,
            assetId: assetMap['Euro'].id,
          },
        },
        create: {
          clientId: systemClientId,
          assetId: assetMap['Euro'].id,
          balance: 3000,
          transactionId: transaction2.id,
        },
        update: {
          balance: {
            increment: 3000,
          },
          transactionId: transaction2.id,
        },
      }),
      // Sistema entrega 3000000 ARS
      prisma.clientBalance.upsert({
        where: {
          clientId_assetId: {
            clientId: systemClientId,
            assetId: assetMap['Peso Argentino'].id,
          },
        },
        create: {
          clientId: systemClientId,
          assetId: assetMap['Peso Argentino'].id,
          balance: -3000000,
          transactionId: transaction2.id,
        },
        update: {
          balance: {
            decrement: 3000000,
          },
          transactionId: transaction2.id,
        },
      }),
    ]);

    // Cliente 3: Transacción pendiente
    const transaction3 = await prisma.transaction.create({
      data: {
        clientId: clients[2].id,
        date: new Date(),
        state: TransactionState.PENDING,
        notes: 'Cambio de dólares a euros - Pendiente',
        createdBy: adminUser.id,
      },
    });

    // Crear detalles de la transacción
    await prisma.transactionDetail.createMany({
      data: [
        {
          transactionId: transaction3.id,
          assetId: assetMap['Dólar Estadounidense'].id,
          movementType: MovementType.INCOME,
          amount: 10000,
          notes: 'Recepción de dólares',
          createdBy: adminUser.id,
        },
        {
          transactionId: transaction3.id,
          assetId: assetMap['Euro'].id,
          movementType: MovementType.EXPENSE,
          amount: 9000,
          notes: 'Entrega de euros pendiente',
          createdBy: adminUser.id,
        },
      ],
    });

    console.log(`✅ Creadas 3 transacciones de prueba:`);
    console.log('- Transacción 1: Completada');
    console.log('- Transacción 2: En cuenta corriente');
    console.log('- Transacción 3: Pendiente');

    console.log(
      '\n✅ Datos de prueba generados correctamente. Ya puedes probar el sistema.',
    );
  } catch (error) {
    console.error('Error al generar datos de prueba:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateTestData();
