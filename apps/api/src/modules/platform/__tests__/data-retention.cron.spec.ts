import { DataRetentionCron } from '../cron/data-retention.cron';

describe('DataRetentionCron (PRIV-002)', () => {
  let cron: DataRetentionCron;
  let mockPrisma: any;
  let mockStorageService: any;
  let mockRedisService: any;

  beforeEach(() => {
    mockPrisma = {
      userDocument: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      voiceTranscript: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      voiceSessionMetric: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      voiceSession: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    mockStorageService = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    mockRedisService = {
      getClient: jest.fn().mockReturnValue({
        set: jest.fn().mockResolvedValue('OK'),
      }),
    };

    cron = new DataRetentionCron(mockPrisma, mockStorageService, mockRedisService);
  });

  it('should delete both cloud storage objects and database records for expired documents', async () => {
    const mockExpiredDocs = [
      {
        id: 'doc-1',
        userId: 'user-1',
        fileAsset: { key: 'resumes/user-1/cv.pdf' },
      },
      {
        id: 'doc-2',
        userId: 'user-2',
        fileAsset: { key: 'jds/user-2/job.pdf' },
      },
      {
        id: 'doc-3',
        userId: 'user-3',
        fileAsset: null, // text-only doc without cloud asset
      },
    ];

    mockPrisma.userDocument.findMany.mockResolvedValue(mockExpiredDocs);
    mockPrisma.userDocument.deleteMany.mockResolvedValue({ count: 3 });

    await cron.handleDailyDataPurge();

    // Verify storageService was called for cloud assets
    expect(mockStorageService.deleteFile).toHaveBeenCalledTimes(2);
    expect(mockStorageService.deleteFile).toHaveBeenCalledWith(
      'user-1',
      'resumes/user-1/cv.pdf',
      'ADMIN',
    );
    expect(mockStorageService.deleteFile).toHaveBeenCalledWith(
      'user-2',
      'jds/user-2/job.pdf',
      'ADMIN',
    );

    // Verify DB deletion was called with correct IDs
    expect(mockPrisma.userDocument.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['doc-1', 'doc-2', 'doc-3'] },
      },
    });

    // Verify audit log creation
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'DATA_RETENTION_PURGE',
          resource: 'system_retention',
        }),
      }),
    );
  });

  it('should handle manual purge by deleting cloud assets and database records', async () => {
    const mockExpiredDocs = [
      {
        id: 'doc-10',
        userId: 'user-10',
        fileAsset: { key: 'resumes/user-10/cv.pdf' },
      },
    ];

    mockPrisma.userDocument.findMany.mockResolvedValue(mockExpiredDocs);
    mockPrisma.userDocument.deleteMany.mockResolvedValue({ count: 1 });

    const result = await cron.triggerManualPurge();

    expect(mockStorageService.deleteFile).toHaveBeenCalledWith(
      'user-10',
      'resumes/user-10/cv.pdf',
      'ADMIN',
    );
    expect(mockPrisma.userDocument.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['doc-10'] } },
    });
    expect(result.purgedDocsCount).toBe(1);
  });
});
