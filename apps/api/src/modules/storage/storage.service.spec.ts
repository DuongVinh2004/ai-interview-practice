import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { MockStorageProvider } from './providers/mock-storage.provider';
import { PrismaService } from '../platform/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('StorageService (Module B1)', () => {
  let service: StorageService;
  let mockProvider: MockStorageProvider;

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
    it('generates a presigned upload URL and unique object key', async () => {
      const userId = '00000000-0000-0000-0000-000000000001';
      const intent = await service.createUploadIntent(userId, {
        filename: 'my_resume.pdf',
        mimeType: 'application/pdf',
        category: 'documents',
      });

      expect(intent.uploadUrl).toContain('mock-storage');
      expect(intent.key).toMatch(/^documents\/00000000-0000-0000-0000-000000000001\/[a-f0-9-]+-my_resume\.pdf$/);
      expect(intent.filename).toBe('my_resume.pdf');
    });

    it('generates public CDN URL when category is public', async () => {
      const userId = '00000000-0000-0000-0000-000000000001';
      const intent = await service.createUploadIntent(userId, {
        filename: 'avatar.png',
        mimeType: 'image/png',
        category: 'public',
      });

      expect(intent.publicUrl).toBeDefined();
      expect(intent.publicUrl).toContain('https://cdn.example.com/public/');
    });
  });

  describe('confirmUpload', () => {
    it('persists FileAsset record in database and logs audit event', async () => {
      const userId = '00000000-0000-0000-0000-000000000001';
      const key = 'documents/00000000-0000-0000-0000-000000000001/sample.pdf';

      mockPrisma.fileAsset.create.mockResolvedValue({
        id: 'asset-123',
        key,
        bucket: 'test-bucket',
        filename: 'sample.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 102400,
        url: null,
        isPublic: false,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const asset = await service.confirmUpload(userId, {
        key,
        filename: 'sample.pdf',
        mimeType: 'application/pdf',
        isPublic: false,
      });

      expect(asset.id).toBe('asset-123');
      expect(asset.key).toBe(key);
      expect(mockPrisma.fileAsset.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('createDownloadIntent', () => {
    it('generates presigned download URL for authorized user', async () => {
      const userId = 'user-1';
      const key = 'documents/user-1/file.pdf';

      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        key,
        userId: 'user-1',
        isPublic: false,
      });

      const result = await service.createDownloadIntent(userId, key);
      expect(result.downloadUrl).toContain('download');
      expect(result.key).toBe(key);
    });

    it('rejects unauthorized download of private asset', async () => {
      const userId = 'user-2';
      const key = 'documents/user-1/file.pdf';

      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        key,
        userId: 'user-1',
        isPublic: false,
      });

      await expect(service.createDownloadIntent(userId, key, 'CANDIDATE')).rejects.toThrow();
    });
  });
});
