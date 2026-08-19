import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode, ApiErrorResponse, ApiFieldError } from '@ai-interview/contracts';
import { ZodError } from 'zod';

export class DomainException extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly fieldErrors?: ApiFieldError[],
  ) {
    super(message);
    this.name = 'DomainException';
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request.headers['x-request-id'] as string) || undefined;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = ErrorCode.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred. Please try again later.';
    let fieldErrors: ApiFieldError[] | undefined = undefined;

    if (exception instanceof DomainException) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      fieldErrors = exception.fieldErrors;
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCode.VALIDATION_ERROR;
      message = 'Validation failed';
      fieldErrors = exception.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        message = resObj.message || exception.message;

        if (Array.isArray(resObj.message)) {
          message = 'Validation failed';
          fieldErrors = resObj.message.map((msg: string) => ({
            field: 'field',
            message: msg,
          }));
        }

        if (resObj.code && Object.values(ErrorCode).includes(resObj.code)) {
          code = resObj.code;
        } else {
          code = this.mapHttpStatusToErrorCode(status);
        }
      } else {
        message = String(res);
        code = this.mapHttpStatusToErrorCode(status);
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled Exception: ${exception.message}`, exception.stack);
      message = process.env.NODE_ENV === 'development' ? exception.message : message;
    }

    const errorResponse: ApiErrorResponse = {
      success: false,
      code,
      message,
      ...(fieldErrors && fieldErrors.length > 0 ? { errors: fieldErrors } : {}),
      ...(requestId ? { requestId } : {}),
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(errorResponse);
  }

  private mapHttpStatusToErrorCode(status: HttpStatus): ErrorCode {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.RESOURCE_NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.IDEMPOTENCY_CONFLICT;
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_ERROR;
      default:
        return ErrorCode.INTERNAL_SERVER_ERROR;
    }
  }
}
