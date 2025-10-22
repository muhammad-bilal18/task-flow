import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
    private requests = new Map<string, { count: number; resetTime: number }>();
    private readonly limit = 100; // requests
    private readonly windowMs = 15 * 60 * 1000; // 15 minutes

    use(req: Request, res: Response, next: NextFunction) {
        const clientId = req.ip || 'unknown';
        const now = Date.now();

        // Get or initialize client record
        let clientRecord = this.requests.get(clientId);

        if (!clientRecord || now > clientRecord.resetTime) {
            clientRecord = {
                count: 0,
                resetTime: now + this.windowMs,
            };
            this.requests.set(clientId, clientRecord);
        }

        clientRecord.count++;

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', this.limit.toString());
        res.setHeader(
            'X-RateLimit-Remaining',
            Math.max(0, this.limit - clientRecord.count).toString(),
        );
        res.setHeader('X-RateLimit-Reset', new Date(clientRecord.resetTime).toISOString());

        // Check if limit exceeded
        if (clientRecord.count > this.limit) {
            throw new HttpException(
                {
                    statusCode: HttpStatus.TOO_MANY_REQUESTS,
                    message: 'Too many requests, please try again later',
                    retryAfter: Math.ceil((clientRecord.resetTime - now) / 1000),
                },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        next();
    }

    // Cleanup old records periodically
    cleanupOldRecords() {
        const now = Date.now();
        for (const [clientId, record] of this.requests.entries()) {
            if (now > record.resetTime) {
                this.requests.delete(clientId);
            }
        }
    }
}
