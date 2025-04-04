#!/bin/bash

echo "🔄 Limpiando la base de datos..."

# Eliminar la base de datos
npx prisma db push --force-reset

# Generar el cliente de Prisma
npx prisma generate

# Ejecutar el script de inicialización
echo "📦 Inicializando datos básicos..."
npx ts-node scripts/initialize-db.ts

echo "✅ Proceso completado" 