import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger(LoggingInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const { method, url, body, user } = request;
        const startTime = Date.now();

        this.logger.log(
            `📥 Incoming Request: ${method} ${url} | User: ${user?.email || 'Anonymous'}`,
        );

        if (Object.keys(body).length > 0) {
            this.logger.debug(`Request Body: ${JSON.stringify(body)}`);
        }

        return next.handle().pipe(
            tap({
                next: (data) => {
                    const duration = Date.now() - startTime;
                    this.logger.log(
                        `📤 Response: ${method} ${url} | Duration: ${duration}ms | Status: Success`,
                    );
                },
                error: (error) => {
                    const duration = Date.now() - startTime;
                    this.logger.error(
                        `❌ Error Response: ${method} ${url} | Duration: ${duration}ms | Error: ${error.message}`,
                    );
                },
            }),
        );
    }
}
