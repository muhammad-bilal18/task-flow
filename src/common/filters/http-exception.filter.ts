import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getResponse<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string | object = 'Internal server error';
        let error = 'Internal Server Error';

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else if (typeof exceptionResponse === 'object') {
                message = (exceptionResponse as any).message || message;
                error = (exceptionResponse as any).error || error;
            }
        } else if (exception instanceof Error) {
            message = exception.message;
            error = exception.name;
        }

        // Log the error
        this.logger.error(
            `Status: ${status} Error: ${JSON.stringify(message)}`,
            exception instanceof Error ? exception.stack : '',
        );

        // Send response
        response.status(status).json({
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            error,
            message,
        });
    }
}
