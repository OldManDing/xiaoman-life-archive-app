import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  ValidationError,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

function flattenValidationErrors(errors: ValidationError[]): Array<{ field: string; reason: string }> {
  const fields: Array<{ field: string; reason: string }> = [];

  for (const error of errors) {
    if (error.constraints) {
      for (const reason of Object.values(error.constraints)) {
        fields.push({ field: error.property, reason });
      }
    }

    if (error.children?.length) {
      fields.push(...flattenValidationErrors(error.children));
    }
  }

  return fields;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const body = exceptionResponse as {
          message?: string | string[];
          fields?: Array<{ field: string; reason: string }>;
          code?: number;
        };

        const fields = Array.isArray(body.message)
          ? body.message.map((message) => ({ field: 'unknown', reason: message }))
          : body.fields;

        response.status(status).json({
          code: body.code ?? this.mapHttpCode(status),
          message: Array.isArray(body.message) ? '参数校验失败' : body.message ?? '请求失败',
          data: fields ? { fields } : null,
        });
        return;
      }

      response.status(status).json({
        code: this.mapHttpCode(status),
        message: exception.message,
        data: null,
      });
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const status = exception.code === 'P2002' ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST;
      response.status(status).json({
        code: status === HttpStatus.CONFLICT ? 1008 : 1005,
        message: status === HttpStatus.CONFLICT ? '重复操作' : '状态不允许',
        data: null,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 1099,
      message: '系统异常',
      data: null,
    });
  }

  private mapHttpCode(status: number): number {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 1001;
      case HttpStatus.UNAUTHORIZED:
        return 1002;
      case HttpStatus.FORBIDDEN:
        return 1003;
      case HttpStatus.NOT_FOUND:
        return 1004;
      case HttpStatus.CONFLICT:
        return 1008;
      case HttpStatus.TOO_MANY_REQUESTS:
        return 1011;
      default:
        return 1099;
    }
  }
}
