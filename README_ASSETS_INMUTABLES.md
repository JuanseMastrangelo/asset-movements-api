# Activos Inmutables en el Sistema de Casa de Cambio

Este documento describe la funcionalidad de activos inmutables en el sistema de casa de cambio.

## ¿Qué son los Activos Inmutables?

Los activos inmutables son aquellos que, una vez creados, no pueden ser modificados ni eliminados. Además, sus reglas de conversión tampoco pueden ser alteradas. Esto permite configurar activos críticos del sistema que deben permanecer inmutables por razones de seguridad o cumplimiento normativo.

## Características de los Activos Inmutables

Cuando un activo es marcado como inmutable:

1. **No se puede modificar su información básica** (nombre, descripción, tipo, etc.)
2. **No se puede desactivar** el activo
3. **No se puede eliminar** el activo
4. **No se pueden crear, modificar o eliminar reglas de conversión** que involucren este activo

## Cómo Crear un Activo Inmutable

Al crear un activo, puedes especificar el campo `isImmutable: true` para marcarlo como inmutable:

```json
{
  "name": "Dólar Estadounidense",
  "description": "USD",
  "type": "PHYSICAL",
  "isPercentage": false,
  "isMtherAccount": false,
  "isImmutable": true
}
```

**IMPORTANTE**: Una vez que un activo es marcado como inmutable, esta propiedad no se puede cambiar. Asegúrate de configurarlo correctamente durante la creación.

## Consideraciones al Trabajar con Activos Inmutables

1. **Planificación Cuidadosa**: Planifica cuidadosamente qué activos deben ser inmutables. Esta decisión no puede revertirse.

2. **Escenarios de Uso**:

   - Activos base del sistema que no deben modificarse
   - Monedas oficiales con requisitos regulatorios específicos
   - Activos históricos que deben preservarse para auditoría

3. **Mensajes de Error**: Si intentas modificar un activo inmutable o sus reglas, el sistema mostrará un mensaje de error claro indicando que el activo es inmutable.

## Ejemplos de Errores

Si intentas modificar un activo inmutable, obtendrás mensajes de error como:

```json
{
  "message": "El activo con ID a6d7f3b2-1e5c-4d8a-9b3e-7f2c1d6e5b4a es inmutable y no puede ser modificado",
  "error": "Bad Request",
  "statusCode": 400
}
```

Si intentas crear o modificar una regla de conversión que involucre un activo inmutable:

```json
{
  "message": "El activo de origen con ID a6d7f3b2-1e5c-4d8a-9b3e-7f2c1d6e5b4a es inmutable y sus reglas no pueden ser modificadas",
  "error": "Bad Request",
  "statusCode": 400
}
```

## Notas para Administradores

Los activos inmutables son una característica de seguridad importante que debe usarse con cuidado. Recomendamos:

1. Identificar claramente qué activos deben ser inmutables antes de crearlos
2. Documentar adecuadamente los activos inmutables en la organización
3. Configurar primero todas las reglas de conversión necesarias antes de marcar un activo como inmutable
4. Probar extensivamente la configuración de activos inmutables en un entorno de prueba antes de aplicarla en producción
