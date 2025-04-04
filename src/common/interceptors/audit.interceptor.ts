import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../audit/audit.service';
import { RequestWithUser } from '../interfaces/auth.interface';
import { getControllerName } from '../utils/controller.utils';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const { body, method, params, user, url } = request;
    const controllerName = getControllerName(context);

    // No auditar endpoints de auditoría para evitar recursión
    if (controllerName === 'AuditController') {
      return next.handle();
    }

    // Solo auditar operaciones de modificación (POST, PATCH, DELETE)
    if (!['POST', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const entityType = controllerName.replace('Controller', '');
    const reqData = { ...body, ...params };
    const entityId = this.getEntityId(method, reqData, params);

    // Si no se puede determinar un ID de entidad, no auditar
    if (!entityId) {
      return next.handle();
    }

    const action = this.mapMethodToAction(method);

    return next.handle().pipe(
      tap({
        next: (data) => {
          // Registrar auditoría después de que la operación sea exitosa
          this.auditService
            .createAuditLog({
              entityType,
              entityId,
              action,
              changedData: {
                request: reqData,
                response: data,
                url,
                method,
              },
              changedBy: user?.sub || 'system',
            })
            .catch((error) => {
              console.error('Error registrando auditoría:', error);
            });
        },
      }),
    );
  }

  private mapMethodToAction(method: string): string {
    switch (method) {
      case 'POST':
        return 'create';
      case 'PATCH':
        return 'update';
      case 'DELETE':
        return 'delete';
      default:
        return 'unknown';
    }
  }

  private getEntityId(method: string, data: any, params: any): string | null {
    // Para operaciones de creación, intentar obtener el ID de la respuesta
    if (method === 'POST' && data?.id) {
      return data.id;
    }

    // Para actualizaciones y eliminaciones, intentar obtener el ID de params
    if (['PATCH', 'DELETE'].includes(method) && params?.id) {
      return params.id;
    }

    // Intentar obtener cualquier ID disponible en body
    if (data?.id) {
      return data.id;
    }

    return null;
  }
}
