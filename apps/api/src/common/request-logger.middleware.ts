import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
    private readonly logger = new Logger('HTTP');

    use(req: any, res: any, next: any): void {
        const correlationId = (req.headers['x-correlation-id'] as string) ?? randomUUID();
        const start = Date.now();

        // Attach correlation ID to request for downstream use
        (req as any).correlationId = correlationId;
        res.setHeader('x-correlation-id', correlationId);

        // Log on response finish
        res.on('finish', () => {
            const duration = Date.now() - start;
            const tenantId = (req as any).tenantContext?.tenantId ?? '-';
            const userId = (req as any).tenantContext?.actorId ?? '-';

            const logEntry = {
                correlationId,
                method: req.method,
                path: req.originalUrl ?? req.url,
                statusCode: res.statusCode,
                durationMs: duration,
                tenantId,
                userId,
                userAgent: req.headers['user-agent'] ?? '-',
                ip: req.ip ?? '-'
            };

            if (res.statusCode >= 500) {
                this.logger.error(JSON.stringify(logEntry));
            } else if (res.statusCode >= 400) {
                this.logger.warn(JSON.stringify(logEntry));
            } else {
                this.logger.log(JSON.stringify(logEntry));
            }
        });

        next();
    }
}
