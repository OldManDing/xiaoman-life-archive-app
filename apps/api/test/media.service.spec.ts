import { FamilyMemberRole, MediaType } from '@prisma/client';

import { MediaService } from '../src/modules/media/media.service';

describe('MediaService', () => {
  const createService = () => {
    const prisma = {
      family: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ familyNo: 'f_001' }),
      },
      recordMedia: {
        create: jest.fn().mockResolvedValue({ mediaNo: 'm_001' }),
        update: jest.fn().mockResolvedValue({
          id: 100n,
          mediaNo: 'm_001',
          width: 1200,
          height: 900,
          durationSeconds: null,
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
          updatedAt: new Date('2026-06-01T00:01:00.000Z'),
        }),
      },
    };
    const accessControlService = {
      ensureChildReadable: jest.fn().mockResolvedValue({
        child: { id: 10n, familyId: 20n, childNo: 'c_001' },
        membership: { role: FamilyMemberRole.owner },
      }),
      ensureMediaReadable: jest.fn().mockResolvedValue({
        media: {
          id: 100n,
          mediaNo: 'm_001',
          objectKey: 'families/f_001/children/c_001/2026/06/m_001.jpg',
          mimeType: 'image/jpeg',
          mediaType: MediaType.image,
          sizeBytes: 1024n,
          status: 1,
        },
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
      headObject: jest.fn().mockResolvedValue({
        exists: true,
        content_length: 1024,
        content_type: 'image/jpeg',
      }),
    };

    return {
      service: new MediaService(prisma as never, accessControlService as never, storageService as never),
      prisma,
      accessControlService,
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

  it('confirms media only after storage metadata matches the upload record', async () => {
    const { service, prisma, storageService } = createService();

    const result = await service.confirm(1n, {
      media_no: 'm_001',
      width: 1200,
      height: 900,
    });

    expect(storageService.headObject).toHaveBeenCalledWith('families/f_001/children/c_001/2026/06/m_001.jpg');
    expect(prisma.recordMedia.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 100n },
      data: expect.objectContaining({
        width: 1200,
        height: 900,
        status: 2,
      }),
    }));
    expect(result).toMatchObject({ media_no: 'm_001', status: 'ready' });
  });

  it('rejects confirmation when the uploaded object size differs from the token record', async () => {
    const { service, storageService } = createService();
    storageService.headObject.mockResolvedValueOnce({
      exists: true,
      content_length: 2048,
      content_type: 'image/jpeg',
    });

    await expect(service.confirm(1n, {
      media_no: 'm_001',
      width: 1200,
      height: 900,
    })).rejects.toThrow('媒体文件大小与上传凭证不一致');
  });
});
