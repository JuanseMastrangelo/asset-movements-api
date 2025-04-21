# Guía para Operaciones con Activos Inmutables (Cable llevar/traer)

Este documento explica cómo utilizar la funcionalidad para registrar operaciones con activos inmutables como "Cable llevar" y "Cable traer" en el sistema.

## Inicialización

Antes de usar la funcionalidad, asegúrate de tener los activos inmutables en la base de datos. Ejecuta alguno de estos comandos:

```bash
# Inicializar toda la base de datos (limpia todos los datos existentes)
npm run db:init

# O solo crear/actualizar los activos necesarios
npm run db:create-assets
```

## Concepto

Las operaciones con "Cable llevar" y "Cable traer" son para registrar movimientos de transferencias internacionales entre clientes, sin afectar los saldos internos. Esto permite mantener la trazabilidad de estas operaciones en el sistema.

## Ejemplo de Uso

Para registrar una operación de pase de mano, haz una petición POST al endpoint:

```
POST /transactions/conciliate-immutable-assets
```

### Ejemplo de Body de la Petición

```json
{
  "clientTransactions": [
    {
      "clientId": "id-cliente-1",
      "assetId": "id-asset-cable-traer",
      "movementType": "INCOME",
      "amount": 10000,
      "notes": "Cable traer del exterior"
    },
    {
      "clientId": "id-cliente-2",
      "assetId": "id-asset-cable-llevar",
      "movementType": "EXPENSE",
      "amount": 6000,
      "notes": "Cable llevar para Cliente 2"
    },
    {
      "clientId": "id-cliente-3",
      "assetId": "id-asset-cable-llevar",
      "movementType": "EXPENSE",
      "amount": 4000,
      "notes": "Cable llevar para Cliente 3"
    }
  ],
  "notes": "Operación de pase de mano Cable traer/llevar"
}
```

En este ejemplo:

1. Un cliente recibe $10,000 como "Cable traer" (entrada de divisas)
2. Dos clientes distintos reciben $6,000 y $4,000 como "Cable llevar" (salida de divisas)
3. El sistema registra estas transacciones relacionándolas entre sí, sin afectar los saldos de los clientes
4. No es necesario que los montos de entrada (INCOME) y salida (EXPENSE) sean iguales

### Resultado

El resultado incluye todas las transacciones creadas:

```json
{
  "data": {
    "incomingTotal": 10000,
    "outgoingTotal": 10000,
    "transactions": [
      {
        "id": "transaction-id-1",
        "client": {
          "id": "id-cliente-1",
          "name": "Nombre Cliente 1"
        },
        "asset": {
          "id": "id-asset-cable-traer",
          "name": "Cable traer"
        },
        "amount": 10000,
        "movementType": "INCOME"
      },
      {
        "id": "transaction-id-2",
        "client": {
          "id": "id-cliente-2",
          "name": "Nombre Cliente 2"
        },
        "asset": {
          "id": "id-asset-cable-llevar",
          "name": "Cable llevar"
        },
        "amount": 6000,
        "movementType": "EXPENSE"
      },
      {
        "id": "transaction-id-3",
        "client": {
          "id": "id-cliente-3",
          "name": "Nombre Cliente 3"
        },
        "asset": {
          "id": "id-asset-cable-llevar",
          "name": "Cable llevar"
        },
        "amount": 4000,
        "movementType": "EXPENSE"
      }
    ]
  },
  "message": "Operación registrada exitosamente"
}
```

## Consideraciones Importantes

1. No es necesario que los montos de entrada (INCOME) y salida (EXPENSE) coincidan
2. Solo se pueden usar activos marcados como inmutables
3. Las transacciones se crean automáticamente como `COMPLETED`
4. Estas operaciones no afectan los saldos de los clientes
5. Toda la operación queda registrada en el log de auditoría

## Consulta de Transacciones

Las transacciones creadas pueden verse a través del endpoint normal de consulta:

```
GET /transactions/{id}
```
