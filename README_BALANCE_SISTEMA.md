# Gestión de Saldo del Sistema

Este documento describe cómo utilizar los nuevos endpoints para gestionar el saldo inicial del sistema de la casa de cambio.

## Endpoints disponibles

### 1. Consultar balances del sistema

**Endpoint:** `GET /assets/system/balances`

**Descripción:** Obtiene los balances actuales del sistema para todos los activos.

**Permisos requeridos:** SUPER_ADMIN, ADMIN, ACCOUNTANT, VIEWER

**Ejemplo de respuesta:**

```json
{
  "data": {
    "systemId": "e51c1089-2e59-4257-8e06-39c6f1b54241",
    "systemName": "Casa de Cambio (Sistema)",
    "balances": [
      {
        "id": "a6d7f3b2-1e5c-4d8a-9b3e-7f2c1d6e5b4a",
        "name": "Dólar Estadounidense",
        "description": "USD",
        "type": "PHYSICAL",
        "balance": 10000
      },
      {
        "id": "b7e8f4c3-2f6d-5e9b-0c4f-8g3d2e7f6c5b",
        "name": "Euro",
        "description": "EUR",
        "type": "PHYSICAL",
        "balance": 8000
      },
      {
        "id": "c8f9g5d4-3g7e-6f0c-1d5g-9h4e3f8g7d6c",
        "name": "Peso Argentino",
        "description": "ARS",
        "type": "PHYSICAL",
        "balance": 500000
      }
    ]
  },
  "message": "Operation completed successfully"
}
```

### 2. Actualizar balance de un activo específico

**Endpoint:** `PATCH /assets/system/balance`

**Descripción:** Actualiza el balance de un activo específico del sistema.

**Permisos requeridos:** SUPER_ADMIN, ADMIN

**Cuerpo de la petición:**

```json
{
  "assetId": "a6d7f3b2-1e5c-4d8a-9b3e-7f2c1d6e5b4a",
  "balance": 15000
}
```

**Ejemplo de respuesta:**

```json
{
  "data": {
    "asset": {
      "id": "a6d7f3b2-1e5c-4d8a-9b3e-7f2c1d6e5b4a",
      "name": "Dólar Estadounidense",
      "type": "PHYSICAL"
    },
    "balance": 15000
  },
  "message": "Operation completed successfully"
}
```

### 3. Actualizar múltiples balances en una operación

**Endpoint:** `PATCH /assets/system/balances/bulk`

**Descripción:** Actualiza los balances de múltiples activos del sistema en una sola operación.

**Permisos requeridos:** SUPER_ADMIN, ADMIN

**Cuerpo de la petición:**

```json
{
  "balances": [
    {
      "assetId": "a6d7f3b2-1e5c-4d8a-9b3e-7f2c1d6e5b4a",
      "balance": 12000
    },
    {
      "assetId": "b7e8f4c3-2f6d-5e9b-0c4f-8g3d2e7f6c5b",
      "balance": 10000
    },
    {
      "assetId": "c8f9g5d4-3g7e-6f0c-1d5g-9h4e3f8g7d6c",
      "balance": 600000
    }
  ]
}
```

**Ejemplo de respuesta:**

```json
{
  "data": {
    "systemId": "e51c1089-2e59-4257-8e06-39c6f1b54241",
    "systemName": "Casa de Cambio (Sistema)",
    "balances": [
      {
        "assetId": "a6d7f3b2-1e5c-4d8a-9b3e-7f2c1d6e5b4a",
        "assetName": "Dólar Estadounidense",
        "assetType": "PHYSICAL",
        "balance": 12000
      },
      {
        "assetId": "b7e8f4c3-2f6d-5e9b-0c4f-8g3d2e7f6c5b",
        "assetName": "Euro",
        "assetType": "PHYSICAL",
        "balance": 10000
      },
      {
        "assetId": "c8f9g5d4-3g7e-6f0c-1d5g-9h4e3f8g7d6c",
        "assetName": "Peso Argentino",
        "assetType": "PHYSICAL",
        "balance": 600000
      }
    ]
  },
  "message": "Operation completed successfully"
}
```

## Ejemplos de uso con curl

### Obtener balances del sistema

```bash
curl -X GET "http://localhost:3000/assets/system/balances" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### Actualizar un balance

```bash
curl -X PATCH "http://localhost:3000/assets/system/balance" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assetId": "a6d7f3b2-1e5c-4d8a-9b3e-7f2c1d6e5b4a",
    "balance": 15000
  }'
```

### Actualizar múltiples balances

```bash
curl -X PATCH "http://localhost:3000/assets/system/balances/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "balances": [
      {
        "assetId": "a6d7f3b2-1e5c-4d8a-9b3e-7f2c1d6e5b4a",
        "balance": 12000
      },
      {
        "assetId": "b7e8f4c3-2f6d-5e9b-0c4f-8g3d2e7f6c5b",
        "balance": 10000
      }
    ]
  }'
```

## Notas importantes

- Los balances actualizan los saldos existentes, no son incrementales. Es decir, si estableces un balance de 12000, este será el nuevo valor absoluto, no se sumará al valor anterior.
- Solo usuarios con roles SUPER_ADMIN o ADMIN pueden modificar los balances del sistema.
- Todos los montos deben ser positivos. Un balance positivo indica que el sistema dispone de ese activo para operar.
- El saldo del sistema afecta directamente a las operaciones de la casa de cambio, por lo que es importante mantener valores coherentes con la realidad.
