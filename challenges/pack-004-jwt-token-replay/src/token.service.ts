export class TokenService {
  async rotateRefreshToken(token: string, db: any) {
    // BUG: Missing token reuse detection
    const record = await db.findToken(token);
    if (!record || record.isRevoked) throw new Error('Invalid token');
    await db.revokeToken(token);
    return db.generateNewToken(record.userId);
  }
}
