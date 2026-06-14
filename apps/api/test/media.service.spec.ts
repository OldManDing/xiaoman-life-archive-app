import { FamilyMemberRole } from '@prisma/client';

import { MediaService } from '../src/modules/media/media.service';

describe('MediaService', () => {
  const createService = () => {
    const prisma = {
      family: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ familyNo: 'f_001' }),
      },
      recordMedia: {
        create: jest.fn().mockResolvedValue({ mediaNo: 'm_001' }),
      },
    };
    const accessControlService = {
      ensureChildReadable: jest.fn().mockResolvedValue({
        child: { id: 10n, familyId: 20n, childNo: 'c_001' },
        membership: { role: FamilyMemberRole.owner },
      }),
    };
    const storageService = {
      createUploadToken: jest.fn().mockResolvedValue({
        upload_url: 'https://storage.example/upload',
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        expires_in: 600,
      }),
    };

    return {
      service: new MediaService(prisma as never, accessControlService as never, storageService as never),
      prisma,
      storageService,
    };
  };

  it('normalizes mobile wildcard image MIME types before creating an upload token', async () => {
    const { service, prisma, storageService } = createService();

    await service.createUploadToken(1n, {
      child_no: 'c_001',
      file_name: 'avatar',
      mime_type: 'image/*',
      size_bytes: 1024,
      media_type: 'image',
    });

    expect(prisma.recordMedia.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mimeType: 'image/jpeg',
          objectKey: expect.stringMatching(/\.jpg$/),
        }),
      }),
    );
    expect(storageService.createUploadToken).toHaveBeenCalledWith(expect.stringMatching(/\.jpg$/), 'image/jpeg');
  });

  it('prefers filename extension over wildcard MIME type when available', async () => {
    const { service, prisma, storageService } = createService();

    await service.createUploadToken(1n, {
      child_no: 'c_001',
      file_name: 'avatar.png',
      mime_type: 'image/*',
      size_bytes: 1024,
      media_type: 'image',
    });

    expect(prisma.recordMedia.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mimeType: 'image/png',
          objectKey: expect.stringMatching(/\.png$/),
        }),
      }),
    );
    expect(storageService.createUploadToken).toHaveBeenCalledWith(expect.stringMatching(/\.png$/), 'image/png');
  });
});
