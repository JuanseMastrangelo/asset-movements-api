import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response, Request } from 'express';
import {
  ApiResponse,
  PaginationMeta,
} from '../interfaces/api-response.interface';

interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export class TransformResponseInterceptor<T extends object>
  implements NestInterceptor<T | PaginatedResponse<T>, ApiResponse<T | T[]>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T | T[]>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    return next.handle().pipe(
      map((responseData: T | PaginatedResponse<T>) => {
        const baseResponse = {
          meta: {
            status: response.statusCode,
            message: 'Operación exitosa',
            timestamp: new Date().toISOString(),
            path: request.url,
          },
        };

        if ('pagination' in responseData && 'items' in responseData) {
          return {
            data: responseData.items,
            meta: {
              ...baseResponse.meta,
              pagination: responseData.pagination,
            },
          };
        }

        return {
          data: responseData,
          meta: baseResponse.meta,
        };
      }),
    );
  }
}
