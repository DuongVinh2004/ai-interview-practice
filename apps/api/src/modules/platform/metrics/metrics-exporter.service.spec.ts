import {
  hasValidMetricsAuthorization,
  serveAuthenticatedMetrics,
} from './metrics-exporter.service';
import { MetricsController } from './metrics.controller';
import { MetricsModule } from './metrics.module';

describe('internal metrics exporter authentication', () => {
  const token = 'metrics-service-token-that-is-at-least-32-characters';

  it('rejects missing, malformed, short-secret, and incorrect credentials', () => {
    expect(hasValidMetricsAuthorization(undefined, token)).toBe(false);
    expect(hasValidMetricsAuthorization(token, token)).toBe(false);
    expect(hasValidMetricsAuthorization(`Bearer ${token}`, 'short-secret')).toBe(false);
    expect(hasValidMetricsAuthorization('Bearer wrong-token', token)).toBe(false);
  });

  it('accepts only the exact bearer service token', () => {
    expect(hasValidMetricsAuthorization(`Bearer ${token}`, token)).toBe(true);
    expect(hasValidMetricsAuthorization(`bearer ${token}`, token)).toBe(false);
    expect(hasValidMetricsAuthorization(`Bearer ${token} `, token)).toBe(false);
  });

  it('does not register the legacy customer API metrics controller', () => {
    const controllers = Reflect.getMetadata('controllers', MetricsModule) || [];
    expect(controllers).not.toContain(MetricsController);
  });

  it('returns 401 without a service token and 200 with the exact token', async () => {
    const metricsService = {
      getMetricsContentType: jest.fn().mockResolvedValue('text/plain'),
      getMetrics: jest.fn().mockResolvedValue('process_cpu_seconds_total 1'),
    } as any;
    const makeResponse = () => ({ writeHead: jest.fn(), end: jest.fn() }) as any;

    const deniedResponse = makeResponse();
    await serveAuthenticatedMetrics(
      { method: 'GET', url: '/metrics', headers: {} } as any,
      deniedResponse,
      metricsService,
      token,
    );
    expect(deniedResponse.writeHead).toHaveBeenCalledWith(
      401,
      expect.objectContaining({ 'Cache-Control': 'no-store' }),
    );
    expect(metricsService.getMetrics).not.toHaveBeenCalled();

    const allowedResponse = makeResponse();
    await serveAuthenticatedMetrics(
      {
        method: 'GET',
        url: '/metrics',
        headers: { authorization: `Bearer ${token}` },
      } as any,
      allowedResponse,
      metricsService,
      token,
    );
    expect(allowedResponse.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({ 'Content-Type': 'text/plain' }),
    );
    expect(allowedResponse.end).toHaveBeenCalledWith('process_cpu_seconds_total 1');
  });
});
