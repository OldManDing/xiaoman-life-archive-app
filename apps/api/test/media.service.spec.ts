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
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: jest.fn().mockResolvedValue({
          mediaNo: 'm_001',
          width: 1200,
          height: 900,
          durationSeconds: null,
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
          updatedAt: new Date('2026-06-01T00:01:00.000Z'),
        }),
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

  it.each([
    ['image', 'photo.jpg', 'application/octet-stream', 'image/jpeg', '.jpg'],
    ['image', 'photo.png', 'image/*', 'image/png', '.png'],
    ['image', 'photo.webp', 'application/octet-stream', 'image/webp', '.webp'],
    ['image', 'photo.heic', 'application/octet-stream', 'image/heic', '.heic'],
    ['image', 'photo.heif', 'application/octet-stream', 'image/heif', '.heif'],
    ['video', 'clip.mp4', 'application/octet-stream', 'video/mp4', '.mp4'],
    ['video', 'clip.webm', 'application/octet-stream', 'video/webm', '.webm'],
    ['video', 'clip.mov', 'application/octet-stream', 'video/quicktime', '.mov'],
    ['video', 'clip.3gp', 'application/octet-stream', 'video/3gpp', '.3gp'],
    ['audio', 'voice.mp3', 'application/octet-stream', 'audio/mpeg', '.mp3'],
    ['audio', 'voice.m4a', 'audio/*', 'audio/x-m4a', '.m4a'],
    ['audio', 'voice.aac', 'application/octet-stream', 'audio/aac', '.aac'],
    ['audio', 'voice.wav', 'application/octet-stream', 'audio/wav', '.wav'],
    ['audio', 'voice.ogg', 'application/octet-stream', 'audio/ogg', '.ogg'],
    ['audio', 'voice.amr', 'application/octet-stream', 'audio/amr', '.amr'],
  ] as const)('creates upload tokens for supported %s format %s', async (mediaType, fileName, pickerMimeType, expectedMimeType, expectedExtension) => {
    const { service, prisma, storageService } = createService();

    await service.createUploadToken(1n, {
      child_no: 'c_001',
      file_name: fileName,
      mime_type: pickerMimeType,
      size_bytes: 1024,
      media_type: mediaType,
    });

    expect(prisma.recordMedia.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mediaType,
          mimeType: expectedMimeType,
          objectKey: expect.stringMatching(new RegExp(`${expectedExtension.replace('.', '\\.')}$`)),
        }),
      }),
    );
    expect(storageService.createUploadToken).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`${expectedExtension.replace('.', '\\.')}$`)), expectedMimeType);
  });

  it('confirms media only after storage metadata matches the upload record', async () => {
    const { service, prisma, storageService } = createService();

    const result = await service.confirm(1n, {
      media_no: 'm_001',
      width: 1200,
      height: 900,
    });

    expect(storageService.headObject).toHaveBeenCalledWith('families/f_001/children/c_001/2026/06/m_001.jpg');
    expect(prisma.recordMedia.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 100n, status: 1, deletedAt: null }),
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

  it('rejects videos longer than the record media duration limit', async () => {
    const { service, prisma, accessControlService, storageService } = createService();
    accessControlService.ensureMediaReadable.mockResolvedValueOnce({
      media: {
        id: 100n,
        mediaNo: 'm_video_001',
        objectKey: 'families/f_001/children/c_001/2026/06/m_video_001.mp4',
        mimeType: 'video/mp4',
        mediaType: MediaType.video,
        sizeBytes: 1024n,
        status: 1,
      },
      membership: { role: FamilyMemberRole.owner },
    });
    storageService.headObject.mockResolvedValueOnce({
      exists: true,
      content_length: 1024,
      content_type: 'video/mp4',
    });

    await expect(service.confirm(1n, {
      media_no: 'm_video_001',
      width: 1280,
      height: 720,
      duration_seconds: 301,
    })).rejects.toThrow('视频时长不能超过5分钟');
    expect(prisma.recordMedia.update).not.toHaveBeenCalled();
  });

  it('rejects audio without readable duration metadata', async () => {
    const { service, prisma, accessControlService, storageService } = createService();
    accessControlService.ensureMediaReadable.mockResolvedValueOnce({
      media: {
        id: 100n,
        mediaNo: 'm_audio_001',
        objectKey: 'families/f_001/children/c_001/2026/06/m_audio_001.m4a',
        mimeType: 'audio/x-m4a',
        mediaType: MediaType.audio,
        sizeBytes: 1024n,
        status: 1,
      },
      membership: { role: FamilyMemberRole.owner },
    });
    storageService.headObject.mockResolvedValueOnce({
      exists: true,
      content_length: 1024,
      content_type: 'audio/x-m4a',
    });

    await expect(service.confirm(1n, {
      media_no: 'm_audio_001',
    })).rejects.toThrow('语音时长读取失败');
    expect(prisma.recordMedia.update).not.toHaveBeenCalled();
  });
});
