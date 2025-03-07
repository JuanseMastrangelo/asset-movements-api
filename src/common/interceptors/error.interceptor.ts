import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

interface ValidationErrorResponse {
  response: {
    message: string[];
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (
      exception instanceof Error &&
      this.isValidationErrorResponse(exception)
    ) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Error de validación',
        errors: exception.response.message,
      });
    }

    if (exception instanceof HttpException) {
      return response.status(exception.getStatus()).json({
        statusCode: exception.getStatus(),
        message: exception.message,
      });
    }

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error interno del servidor',
    });
  }

  private isValidationErrorResponse(
    error: unknown,
  ): error is ValidationErrorResponse {
    const maybeError = error as Record<string, unknown>;
    return (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof maybeError.response === 'object' &&
      maybeError.response !== null &&
      'message' in maybeError.response &&
      Array.isArray((maybeError.response as Record<string, unknown>).message)
    );
  }
}
