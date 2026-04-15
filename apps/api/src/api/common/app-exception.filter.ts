import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaClientInitializationError } from '@prisma/client/runtime/library';
import { AppError, isAppError } from '../../application/errors';

/** Prisma/client errors that often mean the DB schema is out of date (e.g. missing column). */
function isPrismaSchemaError(exception: unknown): boolean {
  if (!(exception instanceof Error)) return false;
  const msg = exception.message ?? '';
  return (
    msg.includes('Unknown column') ||
    msg.includes('does not exist') ||
    (msg.includes('column') && msg.includes('does not exist'))
  );
}

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (isAppError(exception)) {
      const status = this.mapAppErrorToStatus(exception);
      return response.status(status).json({
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
      });
    }

    if (exception instanceof PrismaClientInitializationError) {
      const message =
        exception.message?.includes('credentials') ||
        exception.message?.includes('Authentication failed')
          ? 'Database connection failed. Check DATABASE_URL in .env and that credentials are valid.'
          : 'Database connection failed. Check DATABASE_URL and that the database server is running.';
      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        error: { code: 'DATABASE_UNAVAILABLE', message },
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res: any = exception.getResponse();
      const message =
        typeof res === 'string' ? res : res?.message ?? 'HTTP_ERROR';
      return response.status(status).json({
        error: {
          code: 'HTTP_ERROR',
          message,
        },
      });
    }

    if (isPrismaSchemaError(exception)) {
      // eslint-disable-next-line no-console
      console.error('Prisma/schema exception', exception);
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: {
          code: 'SCHEMA_OUT_OF_DATE',
          message:
            'Database schema may be out of date. From repo root run: npm run prisma:migrate then npm run prisma:generate and restart the API. Or from apps/api: npx prisma migrate deploy --schema=src/infra/prisma/schema.prisma',
        },
      });
    }

    // Plain Error (e.g. from create-ack-invoice-draft validation): return message so client can show it
    if (exception instanceof Error) {
      const message = exception.message || 'An error occurred';
      return response.status(HttpStatus.BAD_REQUEST).json({
        error: {
          code: 'ERROR',
          message,
        },
      });
    }

    // Fallback
    // eslint-disable-next-line no-console
    console.error('Unhandled exception', exception);
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected error',
      },
    });
  }

  private mapAppErrorToStatus(error: AppError): number {
    switch (error.code) {
      case 'MIN_KG_NOT_MET':
      case 'SUBSCRIPTION_EXPIRED':
      case 'NO_REMAINING_PICKUPS':
      case 'EXCEEDED_LIMIT':
      case 'PINCODE_NOT_SERVICEABLE':
      case 'BRANCH_NOT_SERVING_PINCODE':
        return HttpStatus.BAD_REQUEST;
      case 'INVALID_STATUS_TRANSITION':
      case 'UNIQUE_CONSTRAINT':
      case 'SLOT_NOT_AVAILABLE':
      case 'SLOT_FULL':
      case 'PINCODE_ALREADY_IN_OTHER_BRANCH':
      case 'CATALOG_ITEM_IN_USE':
        return HttpStatus.CONFLICT;
      case 'ADDRESS_NOT_FOUND':
      case 'BRANDING_NOT_FOUND':
      case 'ASSET_NOT_FOUND':
      case 'ITEM_NOT_FOUND':
      case 'PLAN_NOT_FOUND':
      case 'CUSTOMER_NOT_FOUND':
      case 'INVOICE_NOT_FOUND':
      case 'ORDER_NOT_FOUND':
      case 'FEEDBACK_NOT_FOUND':
        return HttpStatus.NOT_FOUND;
      case 'ADDRESS_NOT_OWNED':
      case 'INVOICE_ACCESS_DENIED':
      case 'ORDER_ACCESS_DENIED':
      case 'FEEDBACK_ACCESS_DENIED':
        return HttpStatus.FORBIDDEN;
      case 'ACK_INVOICE_NOT_ALLOWED':
      case 'FINAL_INVOICE_NOT_ALLOWED':
      case 'FEEDBACK_ALREADY_EXISTS':
      case 'FEEDBACK_NOT_ALLOWED':
        return HttpStatus.CONFLICT;
      case 'PAYMENT_INVALID':
      case 'ANALYTICS_INVALID_RANGE':
      case 'FEEDBACK_INVALID':
      case 'DESCRIPTION_TOO_LONG':
      case 'SUBSCRIPTION_PLAN_ALREADY_REDEEMED':
        return HttpStatus.BAD_REQUEST;
      case 'USER_DISABLED':
        return HttpStatus.FORBIDDEN;
      case 'CANNOT_DISABLE_SELF':
        return HttpStatus.CONFLICT;
      case 'CANNOT_DELETE_PROTECTED':
        return HttpStatus.FORBIDDEN;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }
}

