export class TokenService {
  async rotateRefreshToken(token: string, db: any) {
    const record = await db.findToken(token);
    if (!record) throw new Error('Token not found');
    if (record.isRevoked) {
      // Token reuse detected! Invalidate entire token family for this user
      await db.revokeAllTokensForUser(record.userId);
      throw new Error('Security Breach: Compromised token reuse detected');
    }
    await db.revokeToken(token);
    return db.generateNewToken(record.userId, record.familyId);
  }
}
