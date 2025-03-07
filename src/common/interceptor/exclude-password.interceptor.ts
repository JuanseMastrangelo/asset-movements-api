import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface Response {
  data?: Record<string, any>;
  [key: string]: any;
}

export class ExcludePasswordInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response> {
    return next.handle().pipe(
      map((response: Response) => {
        if (response?.data) {
          // Si es una respuesta transformada
          delete response.data.password;
          return response;
        }
        // Si es una respuesta directa
        delete response.password;
        return response;
      }),
    );
  }
}
