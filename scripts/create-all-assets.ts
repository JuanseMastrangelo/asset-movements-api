import { PrismaClient, AssetType } from '@prisma/client';

const prisma = new PrismaClient();

async function createAllAssets() {
  try {
    console.log('Creando todos los tipos de activos necesarios...');

    // Lista completa de activos
    const assets = [
      {
        name: 'Dólares cara chica',
        description: 'USD cara chica',
        type: AssetType.PHYSICAL,
      },
      {
        name: 'Dólares',
        description: 'USD estándar',
        type: AssetType.PHYSICAL,
      },
      {
        name: 'Dólares feos',
        description: 'USD deteriorados',
        type: AssetType.PHYSICAL,
      },
      {
        name: 'Euros',
        description: 'EUR',
        type: AssetType.PHYSICAL,
      },
      {
        name: 'Pesos',
        description: 'ARS',
        type: AssetType.PHYSICAL,
      },
      {
        name: 'Reales',
        description: 'BRL',
        type: AssetType.PHYSICAL,
      },
      {
        name: 'USDT',
        description: 'Tether USD',
        type: AssetType.DIGITAL,
        isPercentage: true,
      },
      {
        name: 'Cable',
        description: 'Transferencia exterior',
        type: AssetType.DIGITAL,
        isPercentage: true,
      },
      {
        name: 'Cable traer',
        description: 'Transferencia del exterior',
        type: AssetType.DIGITAL,
        isImmutable: true,
      },
      {
        name: 'Cable llevar',
        description: 'Transferencia al exterior',
        type: AssetType.DIGITAL,
        isImmutable: true,
      },
      {
        name: 'Cheque',
        description: 'Cheque',
        type: AssetType.DIGITAL,
        isPercentage: true,
      },
      {
        name: 'Transferencia Peso',
        description: 'TR Pesos',
        type: AssetType.DIGITAL,
      },
      {
        name: 'Préstamo',
        description: 'Préstamo (Egreso)',
        type: AssetType.DIGITAL,
      },
      {
        name: 'Deuda',
        description: 'Deuda (Ingreso)',
        type: AssetType.DIGITAL,
      },
      {
        name: 'Gastos',
        description: 'Gastos operativos',
        type: AssetType.DIGITAL,
      },
      {
        name: 'Comisión',
        description: 'Comisión por operación',
        type: AssetType.DIGITAL,
        isPercentage: true,
        isMtherAccount: true,
      },
    ];

    // Crear o actualizar cada activo
    for (const asset of assets) {
      const existingAsset = await prisma.asset.findFirst({
        where: {
          name: asset.name,
        },
      });

      if (existingAsset) {
        await prisma.asset.update({
          where: {
            id: existingAsset.id,
          },
          data: {
            description: asset.description,
            type: asset.type,
            isPercentage: asset.isPercentage || false,
            isMtherAccount: asset.isMtherAccount || false,
            isActive: true,
          },
        });
        console.log(`📝 Actualizado: ${asset.name}`);
      } else {
        const newAsset = await prisma.asset.create({
          data: {
            name: asset.name,
            description: asset.description,
            type: asset.type,
            isPercentage: asset.isPercentage || false,
            isMtherAccount: asset.isMtherAccount || false,
            isActive: true,
          },
        });
        console.log(`✅ Creado: ${asset.name} (ID: ${newAsset.id})`);
      }
    }

    console.log(
      '\n✅ Todos los activos fueron creados o actualizados correctamente.',
    );
  } catch (error) {
    console.error('Error al crear activos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAllAssets();
