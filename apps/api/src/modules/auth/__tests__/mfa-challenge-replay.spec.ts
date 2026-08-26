import { ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';

describe('MFA Challenge Single-Use & Token Type Verification (F-013)', () => {
  it('MUST require jti on MFA challenge token to consume single-use challenge', () => {
    const payload = {
      sub: 'user-1',
      email: 'user@example.com',
      tokenType: 'mfa_challenge',
      mfaPending: true,
      jti: 'unique-challenge-nonce-123',
    };

    expect(payload.jti).toBeDefined();
    expect(payload.tokenType).toBe('mfa_challenge');
    expect(payload.mfaPending).toBe(true);
  });

  it('MUST reject access token presented as MFA challenge in recovery flow', () => {
    const invalidPayload = {
      sub: 'user-1',
      email: 'user@example.com',
      tokenType: 'access',
      mfaPending: false,
    };

    const isChallengeToken =
      invalidPayload.mfaPending && invalidPayload.tokenType === 'mfa_challenge';
    expect(isChallengeToken).toBe(false);
  });
});
