package com.xmlga.nianlun;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "NativeExport")
public class NativeExportPlugin extends Plugin {
    private static final String DEFAULT_FILE_NAME = "nianlun-export-summary.txt";

    @PluginMethod
    public void saveTextFile(PluginCall call) {
        String content = call.getString("content");
        if (content == null) {
            call.reject("content required");
            return;
        }

        String rawFileName = call.getString("fileName");
        String fileName = sanitizeFileName(rawFileName == null ? DEFAULT_FILE_NAME : rawFileName);
        String mimeType = call.getString("mimeType");
        if (mimeType == null || mimeType.trim().isEmpty()) {
            mimeType = "text/plain";
        }

        try {
            JSObject result = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    ? saveWithMediaStore(fileName, content, mimeType)
                    : saveLegacy(fileName, content);
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("save text file failed: " + exception.getMessage());
        }
    }

    private JSObject saveWithMediaStore(String fileName, String content, String mimeType) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            throw new IllegalStateException("download uri unavailable");
        }

        try (OutputStream outputStream = resolver.openOutputStream(uri)) {
            if (outputStream == null) {
                throw new IllegalStateException("download output stream unavailable");
            }
            outputStream.write(content.getBytes(StandardCharsets.UTF_8));
            outputStream.flush();
        }

        values.clear();
        values.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(uri, values, null, null);

        JSObject result = new JSObject();
        result.put("saved", true);
        result.put("fileName", fileName);
        result.put("uri", uri.toString());
        result.put("directory", Environment.DIRECTORY_DOWNLOADS);
        return result;
    }

    private JSObject saveLegacy(String fileName, String content) throws Exception {
        File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (!downloadsDir.exists() && !downloadsDir.mkdirs()) {
            throw new IllegalStateException("downloads directory unavailable");
        }

        File outputFile = new File(downloadsDir, fileName);
        try (FileOutputStream outputStream = new FileOutputStream(outputFile, false)) {
            outputStream.write(content.getBytes(StandardCharsets.UTF_8));
            outputStream.flush();
        }

        JSObject result = new JSObject();
        result.put("saved", true);
        result.put("fileName", fileName);
        result.put("path", outputFile.getAbsolutePath());
        result.put("directory", Environment.DIRECTORY_DOWNLOADS);
        return result;
    }

    private String sanitizeFileName(String fileName) {
        String safeFileName = fileName.replaceAll("[\\\\/:*?\"<>|\\r\\n]+", "-").trim();
        return safeFileName.isEmpty() ? DEFAULT_FILE_NAME : safeFileName;
    }
}
