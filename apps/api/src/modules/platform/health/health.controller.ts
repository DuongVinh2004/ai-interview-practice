import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { Public } from '../../auth/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Application is alive' })
  getLive() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiResponse({ status: 200, description: 'Application dependencies are ready' })
  async getReady(@Res() res: Response) {
    const checks: Record<string, 'up' | 'down'> = {
      database: 'down',
      redis: 'down',
    };

    const timeoutMs = 2500;

    const withTimeout = async <T>(promise: Promise<T>): Promise<T> => {
      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Timeout')), timeoutMs);
        if (typeof timer.unref === 'function') timer.unref();
      });
      try {
        return await Promise.race([promise, timeoutPromise]);
      } finally {
        clearTimeout(timer!);
      }
    };

    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`);
      checks.database = 'up';
    } catch {
      checks.database = 'down';
    }

    try {
      const pong = await withTimeout(this.redis.getClient().ping());
      if (pong === 'PONG') {
        checks.redis = 'up';
      }
    } catch {
      checks.redis = 'down';
    }

    const isReady = checks.database === 'up' && checks.redis === 'up';

    return res.status(isReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({
      status: isReady ? 'ok' : 'error',
      checks,
      timestamp: new Date().toISOString(),
    });
  }
}
