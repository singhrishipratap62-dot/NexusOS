import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) { }

  @Public()
  @Get()
  async getHealth(): Promise<{
    status: string;
    timestamp: string;
    uptime: number;
    memory: { rss: number; heapUsed: number; heapTotal: number };
    database: string;
    version: string;
  }> {
    let dbStatus = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }

    const mem = process.memoryUsage();

    return {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024)
      },
      database: dbStatus,
      version: process.env.npm_package_version ?? '0.1.0'
    };
  }
}
