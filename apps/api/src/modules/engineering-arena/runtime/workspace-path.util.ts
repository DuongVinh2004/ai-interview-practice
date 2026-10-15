import * as path from 'path';

export function assertSafeWorkspacePath(rawPath: string): void {
  if (typeof rawPath !== 'string' || !rawPath.trim()) {
    throw new Error('Security violation: Workspace file path must be a non-empty string.');
  }

  // Null byte injection check
  if (rawPath.includes('\0')) {
    throw new Error(`Security violation: Null byte detected in path '${rawPath}'.`);
  }

  // Windows drive letter check (e.g., C:\ or d:/)
  if (/^[a-zA-Z]:/.test(rawPath)) {
    throw new Error(`Security violation: Windows drive letter detected in path '${rawPath}'.`);
  }

  // Raw traversal or absolute check
  if (rawPath.startsWith('/') || rawPath.startsWith('\\') || rawPath.includes('..')) {
    throw new Error(`Security violation: Path traversal detected in '${rawPath}'.`);
  }

  // URL decoding check (against %2e%2e, %2f, etc.)
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    throw new Error(`Security violation: Malformed URI encoding in '${rawPath}'.`);
  }

  if (decoded !== rawPath) {
    if (
      decoded.includes('..') ||
      decoded.startsWith('/') ||
      decoded.startsWith('\\') ||
      /^[a-zA-Z]:/.test(decoded)
    ) {
      throw new Error(`Security violation: Encoded path traversal detected in '${rawPath}'.`);
    }
  }

  // Path normalization check
  const normalized = path.posix.normalize(decoded.replace(/\\/g, '/'));
  if (
    normalized.startsWith('/') ||
    normalized.startsWith('../') ||
    normalized === '..' ||
    normalized.includes('/../') ||
    normalized.endsWith('/..')
  ) {
    throw new Error(`Security violation: Normalized path traversal detected in '${rawPath}'.`);
  }
}
