import {
  PrismaClient,
  UserRole,
  AssetType,
  MovementType,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function initializeDatabase() {
  try {
    console.log('Iniciando la creación de datos básicos...');

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
    ]);

    console.log('\nActivos creados:');
    assets.forEach((asset) => {
      console.log(`- ${asset.name} (${asset.description}): ${asset.id}`);
    });

    // 4. Crear denominaciones para cada activo físico
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

    // 5. Establecer balances iniciales del sistema
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

    // 6. Crear un cliente de prueba
    const testClient = await prisma.client.create({
      data: {
        name: 'Cliente de Prueba',
        email: 'test@example.com',
        phone: '+123456789',
        address: 'Dirección de prueba',
        country: 'País de prueba',
        isActive: true,
      },
    });

    console.log('\nCliente de prueba creado:');
    console.log('- ID:', testClient.id);
    console.log('- Nombre:', testClient.name);

    // 7. Crear una transacción de prueba
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
        // Crear la transacción
        const transaction = await prisma.transaction.create({
          data: {
            client: {
              connect: { id: testClient.id },
            },
            createdByUser: {
              connect: { id: adminUser.id },
            },
            notes: 'Transacción de prueba con billetes',
          },
        });

        // Crear el detalle de transacción para USD (entrada)
        const usdDetail = await prisma.transactionDetail.create({
          data: {
            transactionId: transaction.id,
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
            transactionId: transaction.id,
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

        console.log('\nTransacción de prueba creada:');
        console.log('- ID:', transaction.id);
        console.log('- Cliente:', testClient.name);
        console.log('- Monto USD:', 285);
        console.log('- Monto EUR:', 260);

        // Nota para futuras mejoras: Implementar transacciones parciales
        // Requiere añadir al esquema Prisma:
        // - isPartial, partialAmount, partialType en TransactionDetail
        // - status, parentTransactionId en Transaction
        // Ver el ejemplo comentado en el código fuente
      } else {
        console.log(
          '\n⚠️ No se encontraron todas las denominaciones necesarias para crear la transacción de prueba',
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
