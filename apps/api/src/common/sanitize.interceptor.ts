import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Recursively strips HTML tags from string values in request/response objects.
 * Prevents XSS attacks on stored data.
 */
function sanitizeValue(value: unknown): unknown {
    if (typeof value === 'string') {
        return value
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]*>/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
    }

    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }

    if (value !== null && typeof value === 'object') {
        const sanitized: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
            sanitized[key] = sanitizeValue(val);
        }
        return sanitized;
    }

    return value;
}

@Injectable()
export class SanitizeInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const request = context.switchToHttp().getRequest();

        // Sanitize request body
        if (request.body && typeof request.body === 'object') {
            request.body = sanitizeValue(request.body);
        }

        // Sanitize query parameters
        if (request.query && typeof request.query === 'object') {
            request.query = sanitizeValue(request.query);
        }

        return next.handle().pipe(
            map((data) => data)
        );
    }
}
