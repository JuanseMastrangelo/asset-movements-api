import {
  PrismaClient,
  UserRole,
  AssetType,
  MovementType,
  TransactionState,
  PaymentResponsibility,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function initializeDatabase() {
  try {
    console.log('Limpiando la base de datos...');

    // Eliminar todas las entidades en orden para evitar violaciones de clave foránea
    await prisma.reconciliation.deleteMany({});
    await prisma.billDetail.deleteMany({});
    await prisma.transactionDetail.deleteMany({});
    await prisma.logistics.deleteMany({});
    await prisma.clientBalance.deleteMany({});
    await prisma.transaction.deleteMany({});
    await prisma.denomination.deleteMany({});
    await prisma.transactionRule.deleteMany({});
    await prisma.logisticsSettings.deleteMany({});
    await prisma.asset.deleteMany({});
    await prisma.client.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});

    console.log(
      'Base de datos limpia. Iniciando la creación de datos básicos...',
    );

    // 1. Crear usuario administrador
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    const adminUser = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@casacambio.com',
        password: hashedPassword,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      },
    });

    console.log('Usuario administrador creado:');
    console.log('- ID:', adminUser.id);
    console.log('- Username: admin');
    console.log('- Password: Admin123!');
    console.log('- Role:', adminUser.role);

    // 2. Crear cliente sistema
    const systemClient = await prisma.client.create({
      data: {
        name: 'Casa de Cambio (Sistema)',
        email: 'sistema@casacambio.com',
        phone: '+123456789',
        address: 'Dirección principal',
        country: 'País de operación',
        isActive: true,
      },
    });

    console.log('\nCliente sistema creado:');
    console.log('- ID:', systemClient.id);
    console.log('- Nombre:', systemClient.name);
    console.log('\n⭐ Agrega este ID a tu archivo .env como SYSTEM_CLIENT_ID');

    // 3. Crear activos básicos
    const assets = await Promise.all([
      prisma.asset.create({
        data: {
          name: 'Dólar Estadounidense',
          description: 'USD',
          type: AssetType.PHYSICAL,
          isActive: true,
        },
      }),
      prisma.asset.create({
        data: {
          name: 'Euro',
          description: 'EUR',
          type: AssetType.PHYSICAL,
          isActive: true,
        },
      }),
      prisma.asset.create({
        data: {
          name: 'Peso Argentino',
          description: 'ARS',
          type: AssetType.PHYSICAL,
          isActive: true,
        },
      }),
      prisma.asset.create({
        data: {
          name: 'Comisión',
          description: 'FEE',
          type: AssetType.DIGITAL,
          isPercentage: true,
          isActive: true,
        },
      }),
      prisma.asset.create({
        data: {
          name: 'Cable llevar',
          description: 'Transferencia al exterior',
          type: AssetType.DIGITAL,
          isImmutable: true,
          isActive: true,
        },
      }),
      prisma.asset.create({
        data: {
          name: 'Cable traer',
          description: 'Transferencia del exterior',
          type: AssetType.DIGITAL,
          isImmutable: true,
          isActive: true,
        },
      }),
    ]);

    console.log('\nActivos creados:');
    assets.forEach((asset) => {
      console.log(`- ${asset.name} (${asset.description}): ${asset.id}`);
    });

    // 4. Crear configuración de logística
    const logisticsSettings = await prisma.logisticsSettings.create({
      data: {
        name: 'Configuración estándar',
        basePrice: 50,
        pricePerKm: 2.5,
        minDistance: 5,
        maxDistance: 100,
        isActive: true,
      },
    });

    console.log('\nConfiguración de logística creada:');
    console.log(
      `- ${logisticsSettings.name}: Base ${logisticsSettings.basePrice}, ${logisticsSettings.pricePerKm}/km`,
    );

    // 5. Crear denominaciones para cada activo físico
    const denominations = [];
    for (const asset of assets) {
      if (asset.type === AssetType.PHYSICAL) {
        const values =
          asset.description === 'USD'
            ? [100, 50, 20, 10, 5, 2, 1]
            : asset.description === 'EUR'
              ? [500, 200, 100, 50, 20, 10, 5, 2, 1]
              : [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

        for (const value of values) {
          const denomination = await prisma.denomination.create({
            data: {
              assetId: asset.id,
              value,
              isActive: true,
            },
          });
          denominations.push(denomination);
        }
      }
    }

    console.log('\nDenominaciones creadas:');
    denominations.forEach((denomination) => {
      const asset = assets.find((a) => a.id === denomination.assetId);
      console.log(`- ${asset?.description}: ${denomination.value}`);
    });

    // 6. Establecer balances iniciales del sistema
    const balances = await Promise.all(
      assets
        .filter((asset) => !asset.isPercentage)
        .map((asset) =>
          prisma.clientBalance.create({
            data: {
              clientId: systemClient.id,
              assetId: asset.id,
              balance: asset.name.includes('Dólar')
                ? 10000
                : asset.name.includes('Euro')
                  ? 8000
                  : asset.name.includes('Peso')
                    ? 500000
                    : 0,
            },
          }),
        ),
    );

    console.log('\nBalances iniciales del sistema creados:');
    for (const balance of balances) {
      const asset = assets.find((a) => a.id === balance.assetId);
      console.log(`- ${asset?.name}: ${balance.balance}`);
    }

    // 7. Crear clientes de prueba
    const testClients = await Promise.all([
      prisma.client.create({
        data: {
          name: 'Cliente de Prueba 1',
          email: 'test1@example.com',
          phone: '+123456789',
          address: 'Dirección de prueba 1',
          country: 'País de prueba',
          isActive: true,
        },
      }),
      prisma.client.create({
        data: {
          name: 'Cliente de Prueba 2',
          email: 'test2@example.com',
          phone: '+987654321',
          address: 'Dirección de prueba 2',
          country: 'País de prueba',
          isActive: true,
        },
      }),
    ]);

    console.log('\nClientes de prueba creados:');
    testClients.forEach((client) => {
      console.log(`- ID: ${client.id}, Nombre: ${client.name}`);
    });

    // 8. Crear transacciones de prueba
    const usdAsset = assets.find((a) => a.description === 'USD');
    const eurAsset = assets.find((a) => a.description === 'EUR');

    if (usdAsset && eurAsset) {
      // Buscar denominaciones
      const usd100 = denominations.find(
        (d) => d.assetId === usdAsset.id && d.value === 100,
      );
      const usd50 = denominations.find(
        (d) => d.assetId === usdAsset.id && d.value === 50,
      );
      const usd20 = denominations.find(
        (d) => d.assetId === usdAsset.id && d.value === 20,
      );
      const usd10 = denominations.find(
        (d) => d.assetId === usdAsset.id && d.value === 10,
      );
      const usd5 = denominations.find(
        (d) => d.assetId === usdAsset.id && d.value === 5,
      );

      const eur100 = denominations.find(
        (d) => d.assetId === eurAsset.id && d.value === 100,
      );
      const eur50 = denominations.find(
        (d) => d.assetId === eurAsset.id && d.value === 50,
      );
      const eur10 = denominations.find(
        (d) => d.assetId === eurAsset.id && d.value === 10,
      );

      // Verificar que todas las denominaciones existan
      if (
        usd100 &&
        usd50 &&
        usd20 &&
        usd10 &&
        usd5 &&
        eur100 &&
        eur50 &&
        eur10
      ) {
        // Crear la transacción para el primer cliente
        const transaction1 = await prisma.transaction.create({
          data: {
            clientId: testClients[0].id,
            createdBy: adminUser.id,
            notes: 'Transacción de prueba con billetes',
            state: TransactionState.COMPLETED,
          },
        });

        // Crear el detalle de transacción para USD (entrada)
        const usdDetail = await prisma.transactionDetail.create({
          data: {
            transactionId: transaction1.id,
            assetId: usdAsset.id,
            movementType: MovementType.INCOME,
            amount: 285,
            createdBy: adminUser.id,
          },
        });

        // Crear billetes para USD
        await Promise.all([
          prisma.billDetail.create({
            data: {
              transactionDetailId: usdDetail.id,
              denominationId: usd100.id,
              quantity: 2,
            },
          }),
          prisma.billDetail.create({
            data: {
              transactionDetailId: usdDetail.id,
              denominationId: usd50.id,
              quantity: 1,
            },
          }),
          prisma.billDetail.create({
            data: {
              transactionDetailId: usdDetail.id,
              denominationId: usd20.id,
              quantity: 1,
            },
          }),
          prisma.billDetail.create({
            data: {
              transactionDetailId: usdDetail.id,
              denominationId: usd10.id,
              quantity: 1,
            },
          }),
          prisma.billDetail.create({
            data: {
              transactionDetailId: usdDetail.id,
              denominationId: usd5.id,
              quantity: 1,
            },
          }),
        ]);

        // Crear el detalle de transacción para EUR (salida)
        const eurDetail = await prisma.transactionDetail.create({
          data: {
            transactionId: transaction1.id,
            assetId: eurAsset.id,
            movementType: MovementType.EXPENSE,
            amount: 260,
            createdBy: adminUser.id,
          },
        });

        // Crear billetes para EUR
        await Promise.all([
          prisma.billDetail.create({
            data: {
              transactionDetailId: eurDetail.id,
              denominationId: eur100.id,
              quantity: 2,
            },
          }),
          prisma.billDetail.create({
            data: {
              transactionDetailId: eurDetail.id,
              denominationId: eur50.id,
              quantity: 1,
            },
          }),
          prisma.billDetail.create({
            data: {
              transactionDetailId: eurDetail.id,
              denominationId: eur10.id,
              quantity: 1,
            },
          }),
        ]);

        // Actualizar balance del cliente 1
        await prisma.clientBalance.create({
          data: {
            clientId: testClients[0].id,
            assetId: usdAsset.id,
            balance: 285, // Positivo porque el cliente entregó dólares
            transactionId: transaction1.id,
          },
        });

        await prisma.clientBalance.create({
          data: {
            clientId: testClients[0].id,
            assetId: eurAsset.id,
            balance: -260, // Negativo porque el cliente recibió euros
            transactionId: transaction1.id,
          },
        });

        // Crear transacción pendiente para el segundo cliente
        const transaction2 = await prisma.transaction.create({
          data: {
            clientId: testClients[1].id,
            createdBy: adminUser.id,
            notes: 'Transacción pendiente para conciliación',
            state: TransactionState.PENDING,
          },
        });

        // Crear detalles para la segunda transacción
        await prisma.transactionDetail.create({
          data: {
            transactionId: transaction2.id,
            assetId: eurAsset.id,
            movementType: MovementType.INCOME,
            amount: 150,
            createdBy: adminUser.id,
          },
        });

        await prisma.transactionDetail.create({
          data: {
            transactionId: transaction2.id,
            assetId: usdAsset.id,
            movementType: MovementType.EXPENSE,
            amount: 170,
            createdBy: adminUser.id,
          },
        });

        // Crear datos de logística para la segunda transacción
        await prisma.logistics.create({
          data: {
            transactionId: transaction2.id,
            originAddress: 'Sucursal Principal',
            destinationAddress: 'Dirección del Cliente 2',
            distance: 15.5,
            price: 88.75, // basePrice + (pricePerKm * distance)
            pricePerKm: logisticsSettings.pricePerKm,
            deliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // mañana
            paymentResponsibility: PaymentResponsibility.SHARED,
            status: 'PENDING',
          },
        });

        // 9. Crear una regla de transacción entre USD y EUR
        await prisma.transactionRule.create({
          data: {
            sourceAssetId: usdAsset.id,
            targetAssetId: eurAsset.id,
            isEnabled: true,
          },
        });

        // Crear un registro de auditoría
        await prisma.auditLog.create({
          data: {
            entityType: 'Transaction',
            entityId: transaction1.id,
            action: 'CREATE',
            changedData: {
              message:
                'Transacción creada durante inicialización de la base de datos',
            },
            changedBy: adminUser.id,
          },
        });

        console.log('\nTransacciones de prueba creadas:');
        console.log('- ID Transacción 1:', transaction1.id);
        console.log('- Cliente:', testClients[0].name);
        console.log('- Monto USD (entregado):', 285);
        console.log('- Monto EUR (recibido):', 260);
        console.log('- Estado: COMPLETED');

        console.log('\n- ID Transacción 2:', transaction2.id);
        console.log('- Cliente:', testClients[1].name);
        console.log('- Monto EUR (a entregar):', 150);
        console.log('- Monto USD (a recibir):', 170);
        console.log('- Estado: PENDING');
        console.log('- Con datos de logística');
      } else {
        console.log(
          '\n⚠️ No se encontraron todas las denominaciones necesarias para crear las transacciones de prueba',
        );
      }
    }

    console.log('\n✅ Inicialización completada con éxito.');
  } catch (error) {
    console.error('Error durante la inicialización:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initializeDatabase();
