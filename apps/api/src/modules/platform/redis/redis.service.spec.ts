import { RedisService } from './redis.service';
import { ConfigService } from '@nestjs/config';

describe('RedisService (Production Fail-Closed Verification / PRD-1002 / REL-001)', () => {
  let service: RedisService;
  let mockConfigService: { get: jest.Mock };

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };
    service = new RedisService(mockConfigService as unknown as ConfigService);
  });

  describe('isProduction', () => {
    it('detects production environment from ConfigService or process.env', () => {
      mockConfigService.get.mockReturnValue('production');
      expect(service.isProduction()).toBe(true);

      mockConfigService.get.mockReturnValue('test');
      expect(service.isProduction()).toBe(false);
    });
  });

  describe('isReady', () => {
    it('returns true when client status is ready or connect', () => {
      (service as any).client = { status: 'ready' };
      expect(service.isReady()).toBe(true);

      (service as any).client = { status: 'connect' };
      expect(service.isReady()).toBe(true);

      (service as any).client = { status: 'close' };
      expect(service.isReady()).toBe(false);

      (service as any).client = undefined;
      expect(service.isReady()).toBe(false);
    });
  });

  describe('assertProductionReady (Fail-Closed Enforcement)', () => {
    it('throws fail-closed error when in production and client is disconnected', () => {
      mockConfigService.get.mockReturnValue('production');
      (service as any).client = { status: 'close' };

      expect(() => service.assertProductionReady()).toThrow(
        /Redis is unavailable in production environment\. In-memory fallback is strictly forbidden/,
      );
    });

    it('does not throw when in production and client is ready', () => {
      mockConfigService.get.mockReturnValue('production');
      (service as any).client = { status: 'ready' };

      expect(() => service.assertProductionReady()).not.toThrow();
    });

    it('does not throw when in test or development even if client is not ready', () => {
      mockConfigService.get.mockReturnValue('test');
      (service as any).client = { status: 'close' };

      expect(() => service.assertProductionReady()).not.toThrow();
    });

    it('blocks getClient, getSubscriber and publish in production if Redis is down', async () => {
      mockConfigService.get.mockReturnValue('production');
      (service as any).client = { status: 'end', publish: jest.fn() };
      (service as any).subscriberClient = { status: 'end' };

      expect(() => service.getClient()).toThrow(/Redis is unavailable/);
      expect(() => service.getSubscriber()).toThrow(/Redis is unavailable/);
      await expect(service.publish('test-channel', { message: 'hello' })).rejects.toThrow(
        /Redis is unavailable/,
      );
    });
  });
});
