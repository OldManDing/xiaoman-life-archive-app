import { Capacitor, registerPlugin } from '@capacitor/core';

type NativeExportSaveResult = {
  saved: boolean;
  fileName?: string;
  uri?: string;
  path?: string;
  directory?: string;
};

type NativeExportPlugin = {
  saveTextFile(options: {
    fileName: string;
    content: string;
    mimeType?: string;
  }): Promise<NativeExportSaveResult>;
};

const NativeExport = registerPlugin<NativeExportPlugin>('NativeExport');

export const saveTextFileToDownloads = async (options: { fileName: string; content: string; mimeType?: string }) => {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    return await NativeExport.saveTextFile(options);
  } catch {
    return null;
  }
};
