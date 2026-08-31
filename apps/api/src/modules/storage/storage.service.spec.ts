import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { MockStorageProvider } from './providers/mock-storage.provider';
import { PrismaService } from '../platform/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { UserRole, ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import { HttpStatus } from '@nestjs/common';

describe('StorageService (Module B1 / SEC-005)', () => {
  let service: StorageService;
  let mockProvider: MockStorageProvider;

  const ownerUserId = '00000000-0000-0000-0000-000000000001';
  const otherUserId = '00000000-0000-0000-0000-000000000002';
  const adminUserId = '00000000-0000-0000-0000-000000000003';

  const mockPrisma = {
    fileAsset: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'storage.awsS3Bucket') return 'test-bucket';
      if (key === 'storage.publicCdnUrl') return 'https://cdn.example.com';
      return null;
    }),
  };

  beforeEach(async () => {
    mockProvider = new MockStorageProvider();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: 'STORAGE_PROVIDER', useValue: mockProvider },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    jest.clearAllMocks();
  });

  describe('createUploadIntent', () => {
    it('generates a presigned upload URL and unique object key bound to userId', async () => {
      const intent = await service.createUploadIntent(ownerUserId, {
        filename: 'my_resume.pdf',
        mimeType: 'application/pdf',
        category: 'documents',
      });

      expect(intent.uploadUrl).toContain('mock-storage');
      expect(intent.key).toMatch(
        /^documents\/00000000-0000-0000-0000-000000000001\/[a-f0-9-]+-my_resume\.pdf$/,
      );
      expect(intent.filename).toBe('my_resume.pdf');
    });

    it('generates public CDN URL when category is public', async () => {
      const intent = await service.createUploadIntent(ownerUserId, {
        filename: 'avatar.png',
        mimeType: 'image/png',
        category: 'public',
      });

      expect(intent.publicUrl).toBeDefined();
      expect(intent.publicUrl).toContain('https://cdn.example.com/public/');
    });
  });

  describe('confirmUpload (SEC-005 Intent Binding & Replay Protection)', () => {
    it('successfully confirms upload with valid intent and persists FileAsset', async () => {
      const intent = await service.createUploadIntent(ownerUserId, {
        filename: 'sample.pdf',
        mimeType: 'application/pdf',
        category: 'documents',
      });

      mockPrisma.fileAsset.findUnique.mockResolvedValue(null);
      mockPrisma.fileAsset.create.mockResolvedValue({
        id: 'asset-123',
        key: intent.key,
        bucket: 'test-bucket',
        filename: 'sample.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 102400,
        url: null,
        isPublic: false,
        userId: ownerUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const asset = await service.confirmUpload(ownerUserId, {
        key: intent.key,
        filename: 'sample.pdf',
        mimeType: 'application/pdf',
        isPublic: false,
      });

      expect(asset.id).toBe('asset-123');
      expect(asset.key).toBe(intent.key);
      expect(mockPrisma.fileAsset.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('rejects confirmation when no upload intent exists (unregistered key)', async () => {
      const unregisteredKey = `documents/${ownerUserId}/unregistered-file.pdf`;

      await expect(
        service.confirmUpload(ownerUserId, {
          key: unregisteredKey,
          filename: 'unregistered-file.pdf',
          mimeType: 'application/pdf',
          isPublic: false,
        }),
      ).rejects.toThrow(
        new DomainException(
          ErrorCode.FORBIDDEN,
          'No valid or active upload intent found for this storage key.',
          HttpStatus.FORBIDDEN,
        ),
      );
      expect(mockPrisma.fileAsset.create).not.toHaveBeenCalled();
    });

    it('rejects cross-user confirmation when caller attempts to claim another user intent', async () => {
      const intent = await service.createUploadIntent(ownerUserId, {
        filename: 'victim-resume.pdf',
        mimeType: 'application/pdf',
        category: 'documents',
      });

      await expect(
        service.confirmUpload(otherUserId, {
          key: intent.key,
          filename: 'victim-resume.pdf',
          mimeType: 'application/pdf',
          isPublic: false,
        }),
      ).rejects.toThrow(
        new DomainException(
          ErrorCode.FORBIDDEN,
          'You are not authorized to confirm an upload initiated by another user.',
          HttpStatus.FORBIDDEN,
        ),
      );
      expect(mockPrisma.fileAsset.create).not.toHaveBeenCalled();
    });

    it('enforces single-use intent and rejects replay of already confirmed intent', async () => {
      const intent = await service.createUploadIntent(ownerUserId, {
        filename: 'single-use.pdf',
        mimeType: 'application/pdf',
        category: 'documents',
      });

      mockPrisma.fileAsset.findUnique.mockResolvedValue(null);
      mockPrisma.fileAsset.create.mockResolvedValue({
        id: 'asset-single-use',
        key: intent.key,
        bucket: 'test-bucket',
        filename: 'single-use.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 5000,
        url: null,
        isPublic: false,
        userId: ownerUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      // First confirmation succeeds
      await service.confirmUpload(ownerUserId, {
        key: intent.key,
        filename: 'single-use.pdf',
        mimeType: 'application/pdf',
        isPublic: false,
      });

      // Second confirmation fails because intent was consumed
      await expect(
        service.confirmUpload(ownerUserId, {
          key: intent.key,
          filename: 'single-use.pdf',
          mimeType: 'application/pdf',
          isPublic: false,
        }),
      ).rejects.toThrow(
        new DomainException(
          ErrorCode.FORBIDDEN,
          'No valid or active upload intent found for this storage key.',
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('rejects confirmation if key is already registered in DB (idempotency conflict)', async () => {
      const intent = await service.createUploadIntent(ownerUserId, {
        filename: 'existing.pdf',
        mimeType: 'application/pdf',
        category: 'documents',
      });

      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'already-existing-asset',
        key: intent.key,
      });

      await expect(
        service.confirmUpload(ownerUserId, {
          key: intent.key,
          filename: 'existing.pdf',
          mimeType: 'application/pdf',
          isPublic: false,
        }),
      ).rejects.toThrow(
        new DomainException(
          ErrorCode.IDEMPOTENCY_CONFLICT,
          'This storage key has already been confirmed as an asset.',
          HttpStatus.CONFLICT,
        ),
      );
    });
  });

  describe('createDownloadIntent (SEC-005 Fail-Closed Unregistered Keys)', () => {
    it('generates presigned download URL for authorized owner of private asset', async () => {
      const key = `documents/${ownerUserId}/file.pdf`;

      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        key,
        userId: ownerUserId,
        isPublic: false,
      });

      const result = await service.createDownloadIntent(ownerUserId, key, UserRole.CANDIDATE);
      expect(result.downloadUrl).toContain('download');
      expect(result.key).toBe(key);
    });

    it('generates presigned download URL for any user when asset is public', async () => {
      const key = `public/${ownerUserId}/logo.png`;

      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'asset-public',
        key,
        userId: ownerUserId,
        isPublic: true,
      });

      const result = await service.createDownloadIntent(otherUserId, key, UserRole.CANDIDATE);
      expect(result.downloadUrl).toContain('download');
      expect(result.key).toBe(key);
    });

    it('allows ADMIN to download any registered private asset', async () => {
      const key = `documents/${ownerUserId}/confidential.pdf`;

      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'asset-admin',
        key,
        userId: ownerUserId,
        isPublic: false,
      });

      const result = await service.createDownloadIntent(adminUserId, key, UserRole.ADMIN);
      expect(result.downloadUrl).toBeDefined();
    });

    it('rejects unauthorized download of private asset by non-owner', async () => {
      const key = `documents/${ownerUserId}/private.pdf`;

      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        key,
        userId: ownerUserId,
        isPublic: false,
      });

      await expect(
        service.createDownloadIntent(otherUserId, key, UserRole.CANDIDATE),
      ).rejects.toThrow(
        new DomainException(
          ErrorCode.FORBIDDEN,
          'You are not authorized to download this private asset.',
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('FAILS CLOSED: rejects download of unregistered key without signing URL', async () => {
      const unregisteredKey = `documents/${ownerUserId}/orphan.pdf`;
      mockPrisma.fileAsset.findUnique.mockResolvedValue(null);

      const spyDownload = jest.spyOn(mockProvider, 'generatePresignedDownloadUrl');

      await expect(
        service.createDownloadIntent(ownerUserId, unregisteredKey, UserRole.CANDIDATE),
      ).rejects.toThrow(
        new DomainException(
          ErrorCode.RESOURCE_NOT_FOUND,
          'File asset not found or not registered.',
          HttpStatus.NOT_FOUND,
        ),
      );

      expect(spyDownload).not.toHaveBeenCalled();
    });
  });

  describe('deleteFile (SEC-005 Fail-Closed Unregistered Keys)', () => {
    it('deletes registered file asset and cloud object when called by owner', async () => {
      const key = `documents/${ownerUserId}/file.pdf`;

      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        key,
        userId: ownerUserId,
      });
      mockPrisma.fileAsset.delete.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const spyDelete = jest.spyOn(mockProvider, 'deleteObject');

      await service.deleteFile(ownerUserId, key, UserRole.CANDIDATE);

      expect(mockPrisma.fileAsset.delete).toHaveBeenCalledWith({ where: { id: 'asset-1' } });
      expect(spyDelete).toHaveBeenCalledWith(key);
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('allows ADMIN to delete any registered file asset', async () => {
      const key = `documents/${ownerUserId}/file.pdf`;

      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        key,
        userId: ownerUserId,
      });
      mockPrisma.fileAsset.delete.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.deleteFile(adminUserId, key, UserRole.ADMIN);
      expect(mockPrisma.fileAsset.delete).toHaveBeenCalledWith({ where: { id: 'asset-1' } });
    });

    it('rejects deletion by non-owner user', async () => {
      const key = `documents/${ownerUserId}/file.pdf`;

      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        key,
        userId: ownerUserId,
      });

      const spyDelete = jest.spyOn(mockProvider, 'deleteObject');

      await expect(service.deleteFile(otherUserId, key, UserRole.CANDIDATE)).rejects.toThrow(
        new DomainException(
          ErrorCode.FORBIDDEN,
          'You are not authorized to delete this file.',
          HttpStatus.FORBIDDEN,
        ),
      );

      expect(spyDelete).not.toHaveBeenCalled();
    });

    it('FAILS CLOSED: rejects deletion of unregistered key without deleting cloud object', async () => {
      const unregisteredKey = `documents/${ownerUserId}/unregistered.pdf`;
      mockPrisma.fileAsset.findUnique.mockResolvedValue(null);

      const spyDelete = jest.spyOn(mockProvider, 'deleteObject');

      await expect(
        service.deleteFile(ownerUserId, unregisteredKey, UserRole.CANDIDATE),
      ).rejects.toThrow(
        new DomainException(
          ErrorCode.RESOURCE_NOT_FOUND,
          'File asset not found or not registered.',
          HttpStatus.NOT_FOUND,
        ),
      );

      expect(spyDelete).not.toHaveBeenCalled();
      expect(mockPrisma.fileAsset.delete).not.toHaveBeenCalled();
    });
  });

  describe('Key normalization and path traversal protection', () => {
    it('rejects keys with path traversal .. attempts', async () => {
      await expect(
        service.createDownloadIntent(ownerUserId, '../../etc/passwd', UserRole.CANDIDATE),
      ).rejects.toThrow(
        new DomainException(
          ErrorCode.VALIDATION_ERROR,
          'Invalid storage key path.',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('normalizes URL encoded keys correctly', async () => {
      const encodedKey = `documents%2F${ownerUserId}%2Ftest.pdf`;
      const expectedNormalized = `documents/${ownerUserId}/test.pdf`;

      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'asset-encoded',
        key: expectedNormalized,
        userId: ownerUserId,
        isPublic: false,
      });

      const result = await service.createDownloadIntent(
        ownerUserId,
        encodedKey,
        UserRole.CANDIDATE,
      );
      expect(result.key).toBe(expectedNormalized);
    });
  });

  describe('PRD-1002 Production Redis intent store invariants', () => {
    it('throws 503 SERVICE_UNAVAILABLE when in production and Redis is unavailable at presign', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalMock = process.env.ALLOW_MOCK_PROVIDERS;
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_MOCK_PROVIDERS = 'true';

      try {
        await expect(
          service.createUploadIntent(ownerUserId, {
            filename: 'resume.pdf',
            mimeType: 'application/pdf',
            category: 'documents',
          }),
        ).rejects.toThrow(
          new DomainException(
            ErrorCode.INTERNAL_SERVER_ERROR,
            'Upload intent store is currently unavailable.',
            HttpStatus.SERVICE_UNAVAILABLE,
          ),
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.ALLOW_MOCK_PROVIDERS = originalMock;
      }
    });

    it('preserves database metadata and retry reference when cloud provider deletion fails', async () => {
      const registeredKey = `documents/${ownerUserId}/retry-target.pdf`;
      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'asset-retry-1',
        key: registeredKey,
        userId: ownerUserId,
        isPublic: false,
      });

      jest.spyOn(mockProvider, 'deleteObject').mockRejectedValueOnce(new Error('Cloud S3 network timeout'));

      await expect(
        service.deleteFile(ownerUserId, registeredKey, UserRole.CANDIDATE),
      ).rejects.toThrow('Cloud S3 network timeout');

      // Database metadata is NOT deleted, retaining retry reference
      expect(mockPrisma.fileAsset.delete).not.toHaveBeenCalled();
    });
  });

  describe('PRD-1003 Runtime upload validation and category byte limits', () => {
    it('rejects filename with path separators or control characters', async () => {
      await expect(
        service.createUploadIntent(ownerUserId, {
          filename: 'nested/dir/resume.pdf',
          mimeType: 'application/pdf',
          category: 'documents',
        }),
      ).rejects.toThrow('Invalid filename format or length.');
    });

    it('rejects filename exceeding 128 characters', async () => {
      const longFilename = `${'a'.repeat(129)}.pdf`;
      await expect(
        service.createUploadIntent(ownerUserId, {
          filename: longFilename,
          mimeType: 'application/pdf',
          category: 'documents',
        }),
      ).rejects.toThrow('Invalid filename format or length.');
    });

    it('rejects MIME type not allowed for category (e.g. executable/script in documents)', async () => {
      await expect(
        service.createUploadIntent(ownerUserId, {
          filename: 'malicious.sh',
          mimeType: 'application/x-sh',
          category: 'documents',
        }),
      ).rejects.toThrow("MIME type 'application/x-sh' is not allowed for category 'documents'.");
    });

    it('rejects confirmUpload when actual object size exceeds category byte limit (5MB for documents)', async () => {
      const intent = await service.createUploadIntent(ownerUserId, {
        filename: 'oversized.pdf',
        mimeType: 'application/pdf',
        category: 'documents',
      });

      mockPrisma.fileAsset.findUnique.mockResolvedValue(null);
      // Simulate uploaded cloud object is 6MB (over 5MB limit)
      jest.spyOn(mockProvider, 'getObjectMetadata').mockResolvedValueOnce({
        size: 6 * 1024 * 1024,
        contentType: 'application/pdf',
        lastModified: new Date(),
      });

      await expect(
        service.confirmUpload(ownerUserId, {
          key: intent.key,
          filename: 'oversized.pdf',
          mimeType: 'application/pdf',
          isPublic: false,
        }),
      ).rejects.toThrow(/exceeds the maximum allowed/);
    });

    it('enforces server-owned visibility and prevents client from turning private category into public', async () => {
      const intent = await service.createUploadIntent(ownerUserId, {
        filename: 'private-doc.pdf',
        mimeType: 'application/pdf',
        category: 'documents',
      });

      mockPrisma.fileAsset.findUnique.mockResolvedValue(null);
      mockPrisma.fileAsset.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'asset-priv', ...data, createdAt: new Date(), updatedAt: new Date() }),
      );
      jest.spyOn(mockProvider, 'getObjectMetadata').mockResolvedValueOnce({
        size: 1024,
        contentType: 'application/pdf',
        lastModified: new Date(),
      });

      const confirmed = await service.confirmUpload(ownerUserId, {
        key: intent.key,
        filename: 'private-doc.pdf',
        mimeType: 'application/pdf',
        isPublic: true, // Client tries to override to public
      });

      // Server-owned visibility derived from category 'documents' (must remain private)
      expect(confirmed.isPublic).toBe(false);
    });
  });
});
