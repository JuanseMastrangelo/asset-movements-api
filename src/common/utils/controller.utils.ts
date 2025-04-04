import { ExecutionContext } from '@nestjs/common';

/**
 * Obtiene el nombre del controlador a partir del contexto de ejecución
 */
export function getControllerName(context: ExecutionContext): string {
  const controller = context.getClass();
  return controller.name;
}

/**
 * Obtiene el nombre de la acción (método del controlador) a partir del contexto de ejecución
 */
export function getActionName(context: ExecutionContext): string {
  const handler = context.getHandler();
  return handler.name;
}
