import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
    catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';

        switch (exception.code) {
            case 'P2002':
                // Unique constraint failed
                status = HttpStatus.CONFLICT;
                message = `Duplicate field value: ${exception.meta?.target}`;
                break;
            case 'P2025':
                // Record not found
                status = HttpStatus.NOT_FOUND;
                message = 'Record not found';
                break;
            case 'P2003':
                // Foreign key constraint failed
                status = HttpStatus.BAD_REQUEST;
                message = 'Invalid reference to related record';
                break;
            case 'P2014':
                // Required relation violation
                status = HttpStatus.BAD_REQUEST;
                message = 'Required relation missing';
                break;
            default:
                // Use default error
                super.catch(exception, host);
                return;
        }

        response.status(status).json({
            statusCode: status,
            timestamp: new Date().toISOString(),
            message,
            error: exception.code,
        });
    }
}
