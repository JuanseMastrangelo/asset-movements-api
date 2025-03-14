import { PrismaClient, UserRole, AssetType } from '@prisma/client';
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

    // 4. Establecer balances iniciales del sistema
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

    console.log('\n✅ Inicialización completada con éxito.');
  } catch (error) {
    console.error('Error durante la inicialización:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initializeDatabase();
