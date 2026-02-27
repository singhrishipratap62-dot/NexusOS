import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function validateEnv(): void {
  // --- Critical vars: crash if missing ---
  const critical: string[] = [];
  if (!process.env.DATABASE_URL) critical.push('DATABASE_URL');
  if (!process.env.JWT_SECRET) critical.push('JWT_SECRET');
  if (!process.env.TOKEN_ENCRYPTION_KEY && !process.env.ENCRYPTION_KEY) {
    critical.push('TOKEN_ENCRYPTION_KEY (or ENCRYPTION_KEY)');
  }
  if (!process.env.REDIS_URL) critical.push('REDIS_URL');

  if (critical.length > 0) {
    console.error('❌ FATAL: Missing required environment variables:');
    critical.forEach(v => console.error(`  - ${v}`));
    console.error('\nThe server cannot start without these. Set them in your .env file.');
    process.exit(1);
  }

  // --- OAuth vars: warn only, connectors become unavailable ---
  const oauthWarnings: string[] = [];
  if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_CLIENT_SECRET) oauthWarnings.push('Slack (SLACK_CLIENT_ID / SLACK_CLIENT_SECRET)');
  const hasGoogle = (process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_CLIENT_ID) &&
    (process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET);
  if (!hasGoogle) oauthWarnings.push('Google/Gmail (GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET)');
  if (!process.env.GITHUB_CLIENT_ID) oauthWarnings.push('GitHub (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET)');

  if (oauthWarnings.length > 0) {
    console.warn('⚠️  OAuth connectors unavailable (env vars not set):');
    oauthWarnings.forEach(w => console.warn(`  - ${w}`));
  }

  // --- LLM: warn if no AI API key is set ---
  if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
    console.warn('⚠️  No AI API key set (GROQ_API_KEY or OPENAI_API_KEY). AI analysis, blueprint generation, and agent reasoning will be disabled.');
  } else if (process.env.GROQ_API_KEY) {
    console.log('✅ Using Groq as AI provider');
  } else {
    console.log(`✅ Using OpenAI as AI provider${process.env.OPENAI_BASE_URL ? ` (baseURL: ${process.env.OPENAI_BASE_URL})` : ''}`);
  }
}

async function bootstrap(): Promise<void> {
  validateEnv();
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3001'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
      maxAge: 86400
    }
  });

  // Security headers (helmet-style, inline to avoid extra dependency)
  app.use((_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0'); // Modern browsers: CSP preferred over XSS-Protection
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.removeHeader('X-Powered-By');
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  // Request body size limits
  app.use(require('express').json({ limit: '1mb' }));

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(`NexusOS API listening on ${host}:${port}`);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
