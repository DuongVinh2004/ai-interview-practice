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

  it('retains the document record when provider deletion fails so a later purge can retry', async () => {
    mockPrisma.userDocument.findMany.mockResolvedValue([
      {
        id: 'doc-retry',
        userId: 'user-retry',
        fileAsset: { key: 'resumes/user-retry/cv.pdf' },
      },
      {
        id: 'doc-text-only',
        userId: 'user-text',
        fileAsset: null,
      },
    ]);
    mockPrisma.userDocument.deleteMany.mockResolvedValue({ count: 1 });
    mockStorageService.deleteFile.mockRejectedValueOnce(new Error('provider unavailable'));

    await cron.handleDailyDataPurge();

    expect(mockPrisma.userDocument.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['doc-text-only'] } },
    });
  });

  it('purges voice transcripts and sessions older than 30 days cutoff', async () => {
    mockPrisma.voiceTranscript.deleteMany.mockResolvedValue({ count: 5 });
    mockPrisma.voiceSession.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.voiceSessionMetric.deleteMany.mockResolvedValue({ count: 10 });

    await cron.handleDailyDataPurge();

    expect(mockPrisma.voiceTranscript.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      }),
    );
    expect(mockPrisma.voiceSession.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      }),
    );
  });

  it('skips execution when distributed lock is already held by another replica', async () => {
    mockRedisService.getClient.mockReturnValue({
      set: jest.fn().mockResolvedValue(null), // Lock acquisition failed
    });

    await cron.handleDailyDataPurge();

    expect(mockPrisma.userDocument.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.userDocument.deleteMany).not.toHaveBeenCalled();
  });
});
