import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { MetricsService } from './modules/platform/metrics/metrics.service';
import { serveAuthenticatedMetrics } from './modules/platform/metrics/metrics-exporter.service';
import { PrismaService } from './modules/platform/prisma/prisma.service';
import { RedisService } from './modules/platform/redis/redis.service';
import * as http from 'http';

async function bootstrapWorker() {
  const logger = new Logger('WorkerBootstrap');
  logger.log('👷 Starting AI Interview Practice BullMQ Worker process...');

  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });

  app.enableShutdownHooks();

  const metricsService = app.get(MetricsService, { strict: false });
  const prismaService = app.get(PrismaService, { strict: false });
  const redisService = app.get(RedisService, { strict: false });

  // Expose lightweight HTTP server for container readiness/liveness and Prometheus scraping (OPS-002)
  const workerPort = parseInt(
    process.env.WORKER_PORT || process.env.WORKER_METRICS_PORT || '9090',
    10,
  );
  const metricsEnabled = process.env.METRICS_EXPORTER_ENABLED === 'true';
  const metricsAuthToken = process.env.METRICS_AUTH_TOKEN || '';

  const server = http.createServer(async (req, res) => {
    const url = req.url || '';

    if (url === '/health/live' || url === '/health/liveness') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ status: 'ok', role: 'worker', timestamp: new Date().toISOString() }),
      );
      return;
    }

    if (url === '/health/ready' || url === '/health/readiness') {
      let dbReady = false;
      let redisReady = false;

      try {
        if (prismaService) {
          await Promise.race([
            prismaService.$queryRaw`SELECT 1`,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500)),
          ]);
          dbReady = true;
        }
      } catch (err: unknown) {
        logger.debug(
          `Worker database readiness check failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      try {
        if (redisService) {
          const pong = await Promise.race([
            redisService.getClient().ping(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500)),
          ]);
          if (pong === 'PONG') redisReady = true;
        }
      } catch (err: unknown) {
        logger.debug(
          `Worker Redis readiness check failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      const isReady = dbReady && redisReady;
      res.writeHead(isReady ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: isReady ? 'ok' : 'error',
          role: 'worker',
          checks: { database: dbReady ? 'up' : 'down', redis: redisReady ? 'up' : 'down' },
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    if (url === '/metrics') {
      if (!metricsEnabled || !metricsService) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      await serveAuthenticatedMetrics(req, res, metricsService, metricsAuthToken);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.listen(workerPort, () => {
    logger.log(
      `📊 Worker health & metrics server listening on port ${workerPort} (/health/live, /health/ready, /metrics)`,
    );
  });

  const handleShutdown = async (signal: string) => {
    logger.log(`Received ${signal}, closing worker gracefully...`);
    try {
      server.close();
    } catch {
      // ignore close errors during shutdown
    }
    try {
      await app.close();
    } catch {
      // ignore close errors during shutdown
    }
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  logger.log(
    '✅ BullMQ Worker is active and listening for background jobs (Questions, Evaluations, Learning Paths).',
  );
}

bootstrapWorker().catch(err => {
  console.error('Fatal worker bootstrap error:', err);
  process.exit(1);
});
