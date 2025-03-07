#!/bin/bash
echo "🔄 Reseteando la base de datos..."
npx prisma migrate reset --force

echo "🚀 Ejecutando script de inicialización..."
npx ts-node scripts/initialize-db.ts

echo "🏦 Creando todos los tipos de activos..."
npx ts-node scripts/create-all-assets.ts

echo "🧩 Generando datos de prueba..."
npx ts-node scripts/generate-test-data.ts

echo "✅ Proceso completo. Ahora puedes usar la aplicación." 