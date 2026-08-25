import { Test, TestingModule } from '@nestjs/testing';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

describe('StorageController (Module B1)', () => {
  let controller: StorageController;
  let service: StorageService;

  const mockStorageService = {
    createUploadIntent: jest.fn(),
    createDownloadIntent: jest.fn(),
    confirmUpload: jest.fn(),
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [{ provide: StorageService, useValue: mockStorageService }],
    }).compile();

    controller = module.get<StorageController>(StorageController);
    service = module.get<StorageService>(StorageService);
    jest.clearAllMocks();
  });

  it('handles presign-upload request', async () => {
    const req = { user: { id: 'user-1' } };
    const dto = { filename: 'cv.pdf', mimeType: 'application/pdf', category: 'documents' as const };
    mockStorageService.createUploadIntent.mockResolvedValue({
      uploadUrl: 'https://upload.url',
      key: 'documents/user-1/cv.pdf',
      filename: 'cv.pdf',
    });

    const result = await controller.presignUpload(req, dto);
    expect(result.uploadUrl).toBe('https://upload.url');
    expect(mockStorageService.createUploadIntent).toHaveBeenCalledWith('user-1', dto);
  });

  it('handles confirm-upload request', async () => {
    const req = { user: { id: 'user-1' } };
    const dto = { key: 'documents/user-1/cv.pdf', filename: 'cv.pdf', mimeType: 'application/pdf', isPublic: false };
    mockStorageService.confirmUpload.mockResolvedValue({
      id: 'asset-1',
      key: dto.key,
      filename: dto.filename,
    });

    const result = await controller.confirmUpload(req, dto);
    expect(result.id).toBe('asset-1');
    expect(mockStorageService.confirmUpload).toHaveBeenCalledWith('user-1', dto);
  });
});
