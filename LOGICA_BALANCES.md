# Lógica de Balances en el Sistema de Casa de Cambio

Este documento explica la lógica para el manejo de balances en el sistema de casa de cambio, tanto para el balance del sistema como para los balances de los clientes.

## Conceptos Básicos

1. **Balance del Sistema**: Representa la cantidad de cada activo que tiene disponible la casa de cambio.

   - Un balance **positivo** indica que el sistema dispone de ese activo.
   - Ejemplo: Si el sistema tiene un balance de 1000 USD, significa que la casa de cambio dispone de 1000 dólares.

2. **Balance del Cliente**: Representa la relación de deuda entre el cliente y la casa de cambio.
   - Un balance **positivo** indica que el cliente debe ese activo a la casa de cambio.
   - Un balance **negativo** indica que la casa de cambio debe ese activo al cliente.
   - Ejemplo: Si un cliente tiene un balance de +100 EUR, significa que el cliente debe 100 euros a la casa de cambio. Si tiene -50 USD, significa que la casa de cambio le debe 50 dólares al cliente.

## Tipos de Movimientos

En cada transacción, los movimientos pueden ser de dos tipos:

1. **INCOME (Ingreso)**: El cliente entrega un activo a la casa de cambio.

   - El sistema **recibe** el activo, por lo que su balance **aumenta**.
   - La deuda del cliente **disminuye**, por lo que su balance **disminuye**.

2. **EXPENSE (Gasto)**: El cliente recibe un activo de la casa de cambio.
   - El sistema **entrega** el activo, por lo que su balance **disminuye**.
   - La deuda del cliente **aumenta**, por lo que su balance **aumenta**.

## Ejemplo de Transacción de Cambio

### Escenario: Cliente cambia 100 EUR por 110 USD

1. **El cliente entrega 100 EUR (INCOME)**:

   - El balance del sistema en EUR **aumenta** en 100 (ahora el sistema tiene 100 EUR más)
   - El balance del cliente en EUR **disminuye** en 100 (ahora el cliente debe 100 EUR menos)

2. **El cliente recibe 110 USD (EXPENSE)**:
   - El balance del sistema en USD **disminuye** en 110 (ahora el sistema tiene 110 USD menos)
   - El balance del cliente en USD **aumenta** en 110 (ahora el cliente debe 110 USD más)

### Resultado Final

Suponiendo que inicialmente el sistema tenía:

- 1000 EUR
- 5000 USD

Y el cliente tenía:

- 0 EUR (sin deuda ni a favor)
- 0 USD (sin deuda ni a favor)

Después de la transacción:

**Sistema:**

- EUR: 1000 + 100 = 1100 EUR
- USD: 5000 - 110 = 4890 USD

**Cliente:**

- EUR: 0 - 100 = -100 EUR (el cliente está a favor, la casa le debe)
- USD: 0 + 110 = +110 USD (el cliente debe a la casa)

## Reconciliación entre Clientes

La reconciliación es un proceso especial que permite transferir deudas entre clientes sin afectar el balance real del sistema. Este proceso es importante para:

1. Saldar deudas entre clientes
2. Mantener el balance real de activos del sistema intacto

### Escenario: Conciliación de Saldos

Supongamos que:

- **Cliente A** debe 100 USD a la casa de cambio (balance: +100 USD)
- La casa de cambio debe 100 USD al **Cliente B** (balance: -100 USD)

En este caso, podemos realizar una conciliación que:

1. Reduce el balance positivo del **Cliente A** a 0
2. Aumenta el balance negativo del **Cliente B** a 0
3. NO afecta al balance del sistema (el sistema sigue manteniendo su inventario real)

Después de la conciliación:

- **Cliente A**: 0 USD (saldado)
- **Cliente B**: 0 USD (saldado)
- **Sistema**: Sin cambios (mantiene su balance real)

Esta operación es puramente contable y no implica un movimiento real de activos en el sistema, sino únicamente un ajuste en las relaciones de deuda entre los clientes y la casa de cambio.

## Implementación en el Código

La lógica para calcular los cambios en los balances se implementa de la siguiente manera:

```typescript
// Para el balance del cliente:
const amountChange =
  detail.movementType === MovementType.INCOME
    ? -detail.amount // Cliente entrega, su deuda disminuye (balance disminuye)
    : detail.amount; // Cliente recibe, su deuda aumenta (balance aumenta)

// Para el balance del sistema (inverso al cliente):
systemBalanceUpdates[assetId] = -1 * amountChange; // El sistema tiene el efecto opuesto al cliente
```

## Consideraciones Importantes

1. Los balances del sistema siempre deben reflejar la cantidad real de activos disponibles.
2. Los balances de los clientes siempre deben reflejar la relación de deuda con la casa de cambio.
3. La suma de todos los balances de clientes para un activo determinado, en su signo inverso, debe coincidir con el balance del sistema para ese activo (si todo está conciliado).
4. Las conciliaciones entre clientes no afectan al balance real del sistema.
5. Cuando un cliente salda completamente su deuda, su balance debe quedar en cero, pero el sistema mantiene su inventario real.
6. Todas las transacciones deben seguir esta lógica consistentemente para mantener la integridad del sistema.
