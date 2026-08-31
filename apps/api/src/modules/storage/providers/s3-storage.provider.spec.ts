import { buildS3ClientConfig } from './s3-storage.provider';

describe('buildS3ClientConfig', () => {
  const region = 'ap-southeast-1';

  it('omits credentials so the AWS SDK uses its default credential provider chain', () => {
    expect(buildS3ClientConfig(region)).toEqual({ region });
    expect(buildS3ClientConfig(region)).not.toHaveProperty('credentials');
  });

  it('uses explicit static credentials only when the complete pair is configured', () => {
    expect(buildS3ClientConfig(region, 'static-access-key', 'static-secret-key')).toEqual({
      region,
      credentials: {
        accessKeyId: 'static-access-key',
        secretAccessKey: 'static-secret-key',
      },
    });
  });

  it('preserves the session token for complete temporary credentials', () => {
    expect(
      buildS3ClientConfig(
        region,
        'temporary-access-key',
        'temporary-secret-key',
        'temporary-session-token',
      ),
    ).toEqual({
      region,
      credentials: {
        accessKeyId: 'temporary-access-key',
        secretAccessKey: 'temporary-secret-key',
        sessionToken: 'temporary-session-token',
      },
    });
  });

  it.each([
    ['access key only', 'static-access-key', undefined],
    ['secret key only', undefined, 'static-secret-key'],
  ])('rejects an incomplete static credential pair: %s', (_case, accessKeyId, secretAccessKey) => {
    expect(() => buildS3ClientConfig(region, accessKeyId, secretAccessKey)).toThrow(
      'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be configured together',
    );
  });

  it.each([
    ['access key', ' ', 'static-secret-key'],
    ['secret key', 'static-access-key', '\t'],
  ])('rejects whitespace in the %s', (_case, accessKeyId, secretAccessKey) => {
    expect(() => buildS3ClientConfig(region, accessKeyId, secretAccessKey)).toThrow(
      'must not contain leading or trailing whitespace',
    );
  });
});
