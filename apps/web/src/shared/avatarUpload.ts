import { webApi } from './api/webApi';
import { createPersistableAvatarPreview, saveLocalMediaPreview, saveRuntimeMediaPreview, toStoredMediaReference } from './localMediaPreview';
import { resolveFileMimeType, withResolvedFileMimeType } from './mediaFiles';
import { readUploadMetadata } from './mediaMetadata';

export const uploadChildAvatar = async (childNo: string, file: File, previewUrl?: string | null) => {
  const uploadFile = withResolvedFileMimeType(file);
  const metadata = await readUploadMetadata('image', previewUrl);
  const uploadToken = await webApi.createUploadToken({
    child_no: childNo,
    file_name: uploadFile.name,
    mime_type: resolveFileMimeType(uploadFile) || uploadFile.type,
    size_bytes: uploadFile.size,
    media_type: 'image',
  });

  if (previewUrl) saveRuntimeMediaPreview(uploadToken.media_no, previewUrl);

  if (!uploadToken.mock_upload) {
    const uploadResponse = await fetch(uploadToken.upload_url, {
      method: uploadToken.method,
      headers: uploadToken.headers,
      body: uploadFile,
    });
    if (!uploadResponse.ok) {
      throw new Error(`头像上传失败：HTTP ${uploadResponse.status}`);
    }
  }

  await webApi.confirmUpload({ media_no: uploadToken.media_no, ...metadata });
  try {
    const preview = await createPersistableAvatarPreview(uploadFile);
    if (preview) {
      saveLocalMediaPreview(uploadToken.media_no, preview);
      saveRuntimeMediaPreview(uploadToken.media_no, preview);
    }
  } catch {
    // The runtime blob preview remains available for the current app session.
  }

  return toStoredMediaReference(uploadToken.media_no);
};
