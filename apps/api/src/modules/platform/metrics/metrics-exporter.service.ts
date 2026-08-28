import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as http from 'http';
import { MetricsService } from './metrics.service';

export function hasValidMetricsAuthorization(
  authorizationHeader: string | undefined,
  expectedToken: string,
): boolean {
  const prefix = 'Bearer ';
  if (!authorizationHeader?.startsWith(prefix) || expectedToken.length < 32) {
    return false;
  }

  const suppliedToken = authorizationHeader.slice(prefix.length);
  const suppliedDigest = crypto.createHash('sha256').update(suppliedToken).digest();
  const expectedDigest = crypto.createHash('sha256').update(expectedToken).digest();
  return crypto.timingSafeEqual(suppliedDigest, expectedDigest);
}

export async function serveAuthenticatedMetrics(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  metricsService: MetricsService,
  expectedToken: string,
): Promise<boolean> {
  const requestUrl = new URL(req.url || '/', 'http://metrics.internal');
  if (req.method !== 'GET' || requestUrl.pathname !== '/metrics') {
    return false;
  }

  if (!hasValidMetricsAuthorization(req.headers.authorization, expectedToken)) {
    res.writeHead(401, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'WWW-Authenticate': 'Bearer',
    });
    res.end('Unauthorized');
    return true;
  }

  try {
    const [contentType, metrics] = await Promise.all([
      metricsService.getMetricsContentType(),
      metricsService.getMetrics(),
    ]);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    });
    res.end(metrics);
  } catch {
    res.writeHead(500, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end('Metrics unavailable');
  }

  return true;
}

@Injectable()
export class MetricsExporterService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MetricsExporterService.name);
  private server?: http.Server;

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const enabled = this.configService.get<string>('METRICS_EXPORTER_ENABLED', 'false') === 'true';
    const role = this.configService.get<string>('PROCESS_ROLE', 'api');
    if (!enabled || role !== 'api') {
      return;
    }

    const expectedToken = this.configService.get<string>('METRICS_AUTH_TOKEN', '');
    if (expectedToken.length < 32) {
      throw new Error('METRICS_AUTH_TOKEN must contain at least 32 characters');
    }

    const host = this.configService.get<string>('METRICS_EXPORTER_HOST', '127.0.0.1');
    const port = Number(this.configService.get<string>('METRICS_EXPORTER_PORT', '9091'));

    this.server = http.createServer(async (req, res) => {
      if (await serveAuthenticatedMetrics(req, res, this.metricsService, expectedToken)) {
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(port, host, () => {
        this.server!.off('error', reject);
        resolve();
      });
    });
    this.logger.log(`Internal metrics exporter listening on ${host}:${port}`);
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.server?.listening) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      this.server!.close(error => (error ? reject(error) : resolve()));
    });
  }
}
