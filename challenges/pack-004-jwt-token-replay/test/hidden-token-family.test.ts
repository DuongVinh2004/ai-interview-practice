import { TokenService } from '../src/token.service';

describe('Hidden Token Family Replay Detection', () => {
  it('revokes entire token family when a revoked token is replayed', async () => {
    const service = new TokenService();
    const mockDb = {
      findToken: jest.fn().mockResolvedValue({ userId: 'u-123', isRevoked: true, familyId: 'f-1' }),
      revokeAllTokensForUser: jest.fn().mockResolvedValue(undefined),
      revokeToken: jest.fn(),
      generateNewToken: jest.fn(),
    };

    await expect(service.rotateRefreshToken('revoked-token', mockDb)).rejects.toThrow(
      /Security Breach|Compromised token reuse/i,
    );
    expect(mockDb.revokeAllTokensForUser).toHaveBeenCalledWith('u-123');
    expect(mockDb.generateNewToken).not.toHaveBeenCalled();
  });
});
