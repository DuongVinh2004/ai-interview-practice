import * as crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export class TotpUtil {
  /**
   * Generates a cryptographically random Base32 secret key (160-bit / 20 bytes by default)
   */
  static generateSecret(byteLength = 20): string {
    const bytes = crypto.randomBytes(byteLength);
    return this.base32Encode(bytes);
  }

  /**
   * Encodes a Buffer into a standard Base32 string (without padding)
   */
  static base32Encode(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
  }

  /**
   * Decodes a Base32 string into a Buffer
   */
  static base32Decode(base32Str: string): Buffer {
    const cleanStr = base32Str.toUpperCase().replace(/=+$/, '').replace(/[\s-]/g, '');
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (let i = 0; i < cleanStr.length; i++) {
      const idx = BASE32_ALPHABET.indexOf(cleanStr[i]);
      if (idx === -1) {
        throw new Error(`Invalid Base32 character: ${cleanStr[i]}`);
      }

      value = (value << 5) | idx;
      bits += 5;

      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(bytes);
  }

  /**
   * Generates the standard otpauth URI for Google Authenticator / 1Password / Authy
   */
  static generateOtpAuthUrl(
    secret: string,
    accountName: string,
    issuer = 'AI Interview Practice',
  ): string {
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedAccount = encodeURIComponent(accountName);
    return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
  }

  /**
   * Generates a 6-digit TOTP token for a given timestamp step (RFC 6238)
   */
  static generateToken(secret: string, timeStep = Math.floor(Date.now() / 1000 / 30)): string {
    const key = this.base32Decode(secret);
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigInt64BE(BigInt(timeStep), 0);

    const hmac = crypto.createHmac('sha1', key).update(timeBuffer).digest();

    // Dynamic truncation
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  }

  /**
   * Verifies a 6-digit token against the secret with clock drift tolerance (±window steps)
   */
  static verifyToken(secret: string, token: string, window = 1): boolean {
    if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
      return false;
    }

    const currentStep = Math.floor(Date.now() / 1000 / 30);
    const tokenBuffer = Buffer.from(token);

    for (let stepOffset = -window; stepOffset <= window; stepOffset++) {
      const step = currentStep + stepOffset;
      const expectedToken = this.generateToken(secret, step);
      const expectedBuffer = Buffer.from(expectedToken);

      if (
        tokenBuffer.length === expectedBuffer.length &&
        crypto.timingSafeEqual(tokenBuffer, expectedBuffer)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generates a set of 8 random single-use recovery codes in XXXX-XXXX-XX format
   */
  static generateRecoveryCodes(count = 8): string[] {
    const codes = new Set<string>();
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Base32 without I, O, 0, 1 for clarity

    while (codes.size < count) {
      const bytes = crypto.randomBytes(10);
      let code = '';
      for (let i = 0; i < 10; i++) {
        code += charset[bytes[i] % charset.length];
      }
      // Format as XXXX-XXXX-XX
      const formatted = `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 10)}`;
      codes.add(formatted);
    }

    return Array.from(codes);
  }

  /**
   * Encrypts plain TOTP secret at rest with AES-256-GCM
   */
  static encryptSecret(plainSecret: string, encryptionKey: string): string {
    const key = crypto.createHash('sha256').update(encryptionKey).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
    let encrypted = cipher.update(plainSecret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts AES-256-GCM encrypted TOTP secret
   */
  static decryptSecret(encryptedPayload: string, encryptionKey: string): string {
    if (!encryptedPayload || !encryptedPayload.includes(':')) {
      throw new Error('Invalid encrypted TOTP payload: missing segment delimiter');
    }
    const [ivHex, authTagHex, cipherHex] = encryptedPayload.split(':');
    if (!ivHex || !authTagHex || !cipherHex) {
      throw new Error('Malformed encrypted TOTP payload: missing components');
    }
    const key = crypto.createHash('sha256').update(encryptionKey).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'), {
      authTagLength: 16,
    });
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
