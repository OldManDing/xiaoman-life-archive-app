package com.xmlga.nianlun;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;

/** Downloads a signed APK into private storage and hands it to Android's installer. */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final String EVENT_DOWNLOAD_PROGRESS = "downloadProgress";
    private static final String UPDATE_DIRECTORY = "updates";
    private static final String APK_MIME_TYPE = "application/vnd.android.package-archive";
    private static final int BUFFER_SIZE = 64 * 1024;
    private static final int MAX_REDIRECTS = 5;
    private static final long PROGRESS_INTERVAL_MS = 100L;
    private static final long MAX_APK_SIZE_BYTES = 512L * 1024L * 1024L;

    private final Object taskLock = new Object();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "nianlun-app-updater");
        thread.setDaemon(true);
        return thread;
    });

    private volatile DownloadTask activeTask;
    private volatile PendingInstall pendingInstall;

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        RequestConfig request;
        try {
            request = parseRequest(call);
        } catch (UpdateException exception) {
            reject(call, exception);
            return;
        }

        DownloadTask task = new DownloadTask(call, request);
        synchronized (taskLock) {
            if (activeTask != null && !activeTask.settled.get()) {
                call.reject("another update is already in progress", "UPDATE_BUSY");
                return;
            }
            activeTask = task;
        }

        call.setKeepAlive(true);
        emitProgress(task, "downloading", 0L, request.expectedSizeBytes, null, true);
        try {
            task.future = executor.submit(() -> runDownload(task));
        } catch (RejectedExecutionException exception) {
            failTask(task, new UpdateException("UPDATER_UNAVAILABLE", "updater is unavailable"));
        }
    }

    /** Installs a verified APK retained after Android asked for unknown-source permission. */
    @PluginMethod
    public void installDownloaded(PluginCall call) {
        PendingInstall pending = pendingInstall;
        if (pending == null || !pending.file.isFile()) {
            call.reject("no downloaded update is available", "NO_PENDING_UPDATE");
            return;
        }

        DownloadTask task = new DownloadTask(call, pending.request, pending.file);
        synchronized (taskLock) {
            if (activeTask != null && !activeTask.settled.get()) {
                call.reject("another update is already in progress", "UPDATE_BUSY");
                return;
            }
            activeTask = task;
            pendingInstall = null;
        }

        call.setKeepAlive(true);
        try {
            task.future = executor.submit(() -> {
                try {
                    emitProgress(task, "verifying", task.file.length(), task.request.expectedSizeBytes, null, true);
                    verifyDownloadedFile(task);
                    checkCancelled(task);
                    mainHandler.post(() -> launchInstaller(task));
                } catch (UpdateException exception) {
                    failTask(task, exception);
                } catch (Exception exception) {
                    failTask(task, new UpdateException("INSTALL_FAILED", safeMessage(exception)));
                }
            });
        } catch (RejectedExecutionException exception) {
            failTask(task, new UpdateException("UPDATER_UNAVAILABLE", "updater is unavailable"));
        }
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        DownloadTask task;
        synchronized (taskLock) {
            task = activeTask;
        }

        if (task == null || task.settled.get() || task.installStarted) {
            JSObject result = new JSObject();
            result.put("cancelled", false);
            call.resolve(result);
            return;
        }

        task.cancelled = true;
        HttpURLConnection connection = task.connection;
        if (connection != null) {
            connection.disconnect();
        }
        Future<?> future = task.future;
        if (future != null) {
            future.cancel(true);
        }
        deleteQuietly(task.file);
        failTask(task, new UpdateException("DOWNLOAD_CANCELLED", "update download cancelled"));

        JSObject result = new JSObject();
        result.put("cancelled", true);
        call.resolve(result);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        DownloadTask task = activeTask;
        JSObject result = new JSObject();
        result.put("active", task != null && !task.settled.get());
        if (task != null) {
            result.put("state", task.state);
            result.put("receivedBytes", task.receivedBytes);
            result.put("totalBytes", task.request.expectedSizeBytes);
            result.put("versionCode", task.request.expectedVersionCode);
        }
        result.put("pendingInstall", pendingInstall != null);
        call.resolve(result);
    }

    @Override
    protected void handleOnDestroy() {
        DownloadTask task = activeTask;
        if (task != null && !task.settled.get()) {
            task.cancelled = true;
            HttpURLConnection connection = task.connection;
            if (connection != null) {
                connection.disconnect();
            }
        }
        executor.shutdownNow();
        super.handleOnDestroy();
    }

    private void runDownload(DownloadTask task) {
        try {
            checkCancelled(task);
            if (!isReusableCachedFile(task)) {
                downloadToFile(task);
            }
            checkCancelled(task);
            emitProgress(task, "verifying", task.file.length(), task.request.expectedSizeBytes, null, true);
            verifyDownloadedFile(task);
            checkCancelled(task);
            task.state = "installing";
            emitProgress(task, "installing", task.request.expectedSizeBytes, task.request.expectedSizeBytes, null, true);
            mainHandler.post(() -> launchInstaller(task));
        } catch (UpdateException exception) {
            failTask(task, exception);
        } catch (Exception exception) {
            failTask(task, new UpdateException("DOWNLOAD_FAILED", safeMessage(exception)));
        }
    }

    private boolean isReusableCachedFile(DownloadTask task) {
        if (!task.file.isFile() || task.file.length() != task.request.expectedSizeBytes) {
            return false;
        }
        try {
            return task.request.expectedSha256.equalsIgnoreCase(sha256(task.file));
        } catch (Exception exception) {
            deleteQuietly(task.file);
            return false;
        }
    }

    private void downloadToFile(DownloadTask task) throws Exception {
        checkCancelled(task);
        File parent = task.file.getParentFile();
        if (parent == null || (!parent.exists() && !parent.mkdirs())) {
            throw new UpdateException("CACHE_UNAVAILABLE", "update cache is unavailable");
        }
        deleteQuietly(task.file);

        HttpURLConnection connection = openConnection(task);
        try {
            long contentLength = connection.getContentLengthLong();
            if (contentLength > 0L && contentLength != task.request.expectedSizeBytes) {
                throw new UpdateException("SIZE_MISMATCH", "server content length does not match update metadata");
            }

            try (InputStream input = new BufferedInputStream(connection.getInputStream(), BUFFER_SIZE);
                 FileOutputStream fileOutput = new FileOutputStream(task.file, false);
                 BufferedOutputStream output = new BufferedOutputStream(fileOutput, BUFFER_SIZE)) {
                byte[] buffer = new byte[BUFFER_SIZE];
                long received = 0L;
                int read;
                while ((read = input.read(buffer)) != -1) {
                    checkCancelled(task);
                    received += read;
                    if (received > task.request.expectedSizeBytes) {
                        throw new UpdateException("SIZE_MISMATCH", "download is larger than update metadata");
                    }
                    output.write(buffer, 0, read);
                    task.receivedBytes = received;
                    emitProgress(task, "downloading", received, task.request.expectedSizeBytes, null, false);
                }
                output.flush();
                fileOutput.getFD().sync();
                if (received != task.request.expectedSizeBytes) {
                    throw new UpdateException("SIZE_MISMATCH", "download size does not match update metadata");
                }
            }
        } finally {
            task.connection = null;
            connection.disconnect();
        }
    }

    private HttpURLConnection openConnection(DownloadTask task) throws Exception {
        URL currentUrl = new URL(task.request.url);
        for (int redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
            if (!isAllowedDownloadUrl(currentUrl)) {
                throw new UpdateException("HTTPS_REQUIRED", "update URL must use HTTPS");
            }

            HttpURLConnection connection = (HttpURLConnection) currentUrl.openConnection();
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(30_000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept", APK_MIME_TYPE);
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("User-Agent", "Nianlun-AppUpdater/1");
            connection.connect();

            int responseCode = connection.getResponseCode();
            if (responseCode >= 300 && responseCode < 400) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null || location.trim().isEmpty()) {
                    throw new UpdateException("REDIRECT_INVALID", "update redirect has no location");
                }
                try {
                    currentUrl = new URI(currentUrl.toString()).resolve(location).toURL();
                } catch (URISyntaxException exception) {
                    throw new UpdateException("REDIRECT_INVALID", "update redirect is invalid");
                }
                continue;
            }
            if (responseCode != HttpURLConnection.HTTP_OK) {
                connection.disconnect();
                throw new UpdateException("HTTP_ERROR", "update server returned HTTP " + responseCode);
            }

            task.connection = connection;
            return connection;
        }
        throw new UpdateException("REDIRECT_LIMIT", "too many update redirects");
    }

    private void verifyDownloadedFile(DownloadTask task) throws Exception {
        checkCancelled(task);
        if (!task.file.isFile()) {
            throw new UpdateException("APK_MISSING", "downloaded APK is missing");
        }
        if (task.file.length() != task.request.expectedSizeBytes) {
            throw new UpdateException("SIZE_MISMATCH", "downloaded APK size is invalid");
        }
        String actualSha256 = sha256(task.file);
        if (!task.request.expectedSha256.equalsIgnoreCase(actualSha256)) {
            throw new UpdateException("HASH_MISMATCH", "downloaded APK checksum is invalid");
        }

        PackageManager packageManager = getContext().getPackageManager();
        int packageInfoFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? PackageManager.GET_SIGNING_CERTIFICATES
                : PackageManager.GET_SIGNATURES;
        PackageInfo archiveInfo = packageManager.getPackageArchiveInfo(task.file.getAbsolutePath(), packageInfoFlags);
        if (archiveInfo == null || !task.request.packageName.equals(archiveInfo.packageName)) {
            throw new UpdateException("PACKAGE_MISMATCH", "downloaded APK package is invalid");
        }

        long archiveVersionCode = versionCode(archiveInfo);
        if (archiveVersionCode != task.request.expectedVersionCode) {
            throw new UpdateException("VERSION_MISMATCH", "downloaded APK version is invalid");
        }

        PackageInfo installedInfo = packageManager.getPackageInfo(task.request.packageName, packageInfoFlags);
        if (archiveVersionCode <= versionCode(installedInfo)) {
            throw new UpdateException("DOWNGRADE_BLOCKED", "downloaded APK is not newer than the installed app");
        }

        if (!signaturesMatch(installedInfo, archiveInfo)) {
            throw new UpdateException("SIGNATURE_MISMATCH", "downloaded APK signature is invalid");
        }
    }

    private void launchInstaller(DownloadTask task) {
        if (task.settled.get() || task.cancelled) {
            return;
        }
        task.installStarted = true;
        Context context = getContext();
        if (context == null || getActivity() == null || getActivity().isFinishing()) {
            failTask(task, new UpdateException("INSTALL_UNAVAILABLE", "app activity is unavailable"));
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.getPackageManager().canRequestPackageInstalls()) {
            pendingInstall = new PendingInstall(task.file, task.request);
            emitProgress(task, "permissionRequired", task.request.expectedSizeBytes, task.request.expectedSizeBytes,
                    "allow installs from this source, then tap install again", true);
            try {
                Intent settingsIntent = new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + context.getPackageName())
                );
                settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(settingsIntent);
            } catch (ActivityNotFoundException exception) {
                failTask(task, new UpdateException("INSTALL_PERMISSION_REQUIRED", "allow installs from this source in system settings"));
                return;
            }

            JSObject result = installResult("permissionRequired", task);
            settleResolve(task, result);
            return;
        }

        try {
            Uri apkUri = FileProvider.getUriForFile(
                    context,
                    context.getPackageName() + ".fileprovider",
                    task.file
            );
            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, APK_MIME_TYPE);
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(installIntent);
            pendingInstall = null;
            settleResolve(task, installResult("installPrompt", task));
        } catch (IllegalArgumentException exception) {
            failTask(task, new UpdateException("INSTALL_UNAVAILABLE", "update file cannot be shared"));
        } catch (ActivityNotFoundException exception) {
            failTask(task, new UpdateException("INSTALL_UNAVAILABLE", "no Android package installer is available"));
        }
    }

    private JSObject installResult(String status, DownloadTask task) {
        JSObject result = new JSObject();
        result.put("status", status);
        result.put("started", "installPrompt".equals(status));
        result.put("requires_permission", "permissionRequired".equals(status));
        result.put("path", task.file.getAbsolutePath());
        result.put("fileName", task.file.getName());
        result.put("sizeBytes", task.file.length());
        result.put("sha256", task.request.expectedSha256);
        result.put("packageName", task.request.packageName);
        result.put("versionCode", task.request.expectedVersionCode);
        return result;
    }

    private RequestConfig parseRequest(PluginCall call) throws UpdateException {
        String url = firstString(call, "url", "apkUrl");
        if (url == null) {
            throw new UpdateException("URL_REQUIRED", "update URL is required");
        }
        try {
            URI parsed = new URI(url);
            if (parsed.getHost() == null || !isAllowedDownloadScheme(parsed.getScheme(), parsed.getHost())) {
                throw new UpdateException("HTTPS_REQUIRED", "update URL must use HTTPS");
            }
        } catch (URISyntaxException exception) {
            throw new UpdateException("URL_INVALID", "update URL is invalid");
        }

        Long expectedSizeBytes = firstLong(call, "sizeBytes", "apkSizeBytes", "expectedSizeBytes");
        if (expectedSizeBytes == null || expectedSizeBytes <= 0L || expectedSizeBytes > MAX_APK_SIZE_BYTES) {
            throw new UpdateException("SIZE_REQUIRED", "a valid APK size is required");
        }

        String expectedSha256 = firstString(call, "sha256", "apkSha256", "expectedSha256");
        if (expectedSha256 == null || !expectedSha256.matches("(?i)[a-f0-9]{64}")) {
            throw new UpdateException("HASH_REQUIRED", "a valid SHA-256 checksum is required");
        }

        Long expectedVersionCode = firstLong(call, "versionCode", "apkVersionCode", "targetVersionCode");
        if (expectedVersionCode == null || expectedVersionCode <= 0L) {
            throw new UpdateException("VERSION_REQUIRED", "a valid version code is required");
        }

        String packageName = firstString(call, "packageName", "apkPackageName");
        if (packageName == null) {
            packageName = getContext().getPackageName();
        }
        if (!getContext().getPackageName().equals(packageName)) {
            throw new UpdateException("PACKAGE_MISMATCH", "update package does not match this app");
        }

        File updateDirectory = new File(getContext().getCacheDir(), UPDATE_DIRECTORY);
        String hashPrefix = expectedSha256.substring(0, 16).toLowerCase(Locale.US);
        File outputFile = new File(updateDirectory, "nianlun-update-" + expectedVersionCode + "-" + hashPrefix + ".apk");
        return new RequestConfig(url, expectedSizeBytes, expectedSha256.toLowerCase(Locale.US), packageName,
                expectedVersionCode, outputFile);
    }

    private boolean isAllowedDownloadUrl(URL url) {
        return isAllowedDownloadScheme(url.getProtocol(), url.getHost());
    }

    private boolean isAllowedDownloadScheme(String scheme, String host) {
        if ("https".equalsIgnoreCase(scheme)) return true;
        // The emulator's 10.0.2.2 bridge is accepted only by debug builds.
        boolean debugBuild = (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        return debugBuild && "http".equalsIgnoreCase(scheme) &&
                ("localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host) || "10.0.2.2".equals(host));
    }

    private String firstString(PluginCall call, String... keys) {
        for (String key : keys) {
            String value = call.getString(key);
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return null;
    }

    private Long firstLong(PluginCall call, String... keys) {
        for (String key : keys) {
            Object rawValue = call.getData().opt(key);
            if (rawValue instanceof Number) {
                return ((Number) rawValue).longValue();
            }
            if (rawValue instanceof String) {
                try {
                    return Long.parseLong(((String) rawValue).trim());
                } catch (NumberFormatException ignored) {
                    // Try the next accepted key.
                }
            }
        }
        return null;
    }

    private long versionCode(PackageInfo packageInfo) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? packageInfo.getLongVersionCode()
                : packageInfo.versionCode;
    }

    private boolean signaturesMatch(PackageInfo installedInfo, PackageInfo archiveInfo) throws NoSuchAlgorithmException {
        Set<String> installed = certificateDigests(installedInfo);
        Set<String> archive = certificateDigests(archiveInfo);
        if (installed.isEmpty() || archive.isEmpty()) {
            return false;
        }
        for (String digest : archive) {
            if (installed.contains(digest)) {
                return true;
            }
        }
        return false;
    }

    private Set<String> certificateDigests(PackageInfo packageInfo) throws NoSuchAlgorithmException {
        Signature[] signatures = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && packageInfo.signingInfo != null) {
            signatures = packageInfo.signingInfo.hasMultipleSigners()
                    ? packageInfo.signingInfo.getApkContentsSigners()
                    : packageInfo.signingInfo.getSigningCertificateHistory();
        }
        if (signatures == null || signatures.length == 0) {
            signatures = packageInfo.signatures;
        }

        Set<String> digests = new HashSet<>();
        if (signatures == null) {
            return digests;
        }
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        for (Signature signature : signatures) {
            if (signature != null) {
                digest.reset();
                digests.add(toHex(digest.digest(signature.toByteArray())));
            }
        }
        return digests;
    }

    private String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new BufferedInputStream(new FileInputStream(file), BUFFER_SIZE)) {
            byte[] buffer = new byte[BUFFER_SIZE];
            int read;
            while ((read = input.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
        }
        return toHex(digest.digest());
    }

    private String toHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            builder.append(String.format(Locale.US, "%02x", value & 0xff));
        }
        return builder.toString();
    }

    private void checkCancelled(DownloadTask task) throws UpdateException {
        if (task.cancelled || Thread.currentThread().isInterrupted()) {
            throw new UpdateException("DOWNLOAD_CANCELLED", "update download cancelled");
        }
    }

    private void emitProgress(DownloadTask task, String state, long receivedBytes, long totalBytes,
                              String message, boolean force) {
        task.state = state;
        task.receivedBytes = receivedBytes;
        long now = System.currentTimeMillis();
        if (!force && now - task.lastProgressAt < PROGRESS_INTERVAL_MS && receivedBytes < totalBytes) {
            return;
        }
        task.lastProgressAt = now;
        JSObject event = new JSObject();
        event.put("state", state);
        event.put("phase", state);
        event.put("receivedBytes", receivedBytes);
        event.put("totalBytes", totalBytes);
        event.put("downloaded_bytes", receivedBytes);
        event.put("total_bytes", totalBytes);
        event.put("progress", totalBytes > 0L ? Math.min(1.0d, (double) receivedBytes / (double) totalBytes) : 0.0d);
        if (message != null) {
            event.put("message", message);
        }
        mainHandler.post(() -> {
            try {
                notifyListeners(EVENT_DOWNLOAD_PROGRESS, event);
            } catch (RuntimeException ignored) {
                // The WebView may already be detached during activity teardown.
            }
        });
    }

    private void failTask(DownloadTask task, UpdateException exception) {
        if (!task.settled.compareAndSet(false, true)) {
            return;
        }
        if ("DOWNLOAD_CANCELLED".equals(exception.code)) {
            task.state = "cancelled";
            emitProgress(task, "cancelled", task.receivedBytes, task.request.expectedSizeBytes, exception.getMessage(), true);
        } else {
            task.state = "error";
            emitProgress(task, "error", task.receivedBytes, task.request.expectedSizeBytes, exception.getMessage(), true);
        }
        deleteQuietly(task.file);
        clearActive(task);
        mainHandler.post(() -> {
            task.call.setKeepAlive(false);
            task.call.reject(exception.getMessage(), exception.code);
        });
    }

    private void reject(PluginCall call, UpdateException exception) {
        call.reject(exception.getMessage(), exception.code);
    }

    private void settleResolve(DownloadTask task, JSObject result) {
        if (!task.settled.compareAndSet(false, true)) {
            return;
        }
        clearActive(task);
        mainHandler.post(() -> {
            task.call.setKeepAlive(false);
            task.call.resolve(result);
        });
    }

    private void clearActive(DownloadTask task) {
        synchronized (taskLock) {
            if (activeTask == task) {
                activeTask = null;
            }
        }
    }

    private void deleteQuietly(File file) {
        if (file != null && file.exists() && !file.delete()) {
            file.deleteOnExit();
        }
    }

    private String safeMessage(Exception exception) {
        String message = exception.getMessage();
        return message == null || message.trim().isEmpty() ? "update operation failed" : message;
    }

    private static final class RequestConfig {
        final String url;
        final long expectedSizeBytes;
        final String expectedSha256;
        final String packageName;
        final long expectedVersionCode;
        final File outputFile;

        RequestConfig(String url, long expectedSizeBytes, String expectedSha256, String packageName,
                      long expectedVersionCode, File outputFile) {
            this.url = url;
            this.expectedSizeBytes = expectedSizeBytes;
            this.expectedSha256 = expectedSha256;
            this.packageName = packageName;
            this.expectedVersionCode = expectedVersionCode;
            this.outputFile = outputFile;
        }
    }

    private static final class DownloadTask {
        final PluginCall call;
        final RequestConfig request;
        final File file;
        final AtomicBoolean settled = new AtomicBoolean(false);
        volatile HttpURLConnection connection;
        volatile Future<?> future;
        volatile boolean cancelled;
        volatile boolean installStarted;
        volatile long receivedBytes;
        volatile long lastProgressAt;
        volatile String state = "queued";

        DownloadTask(PluginCall call, RequestConfig request) {
            this(call, request, request.outputFile);
        }

        DownloadTask(PluginCall call, RequestConfig request, File file) {
            this.call = call;
            this.request = request;
            this.file = file;
        }
    }

    private static final class PendingInstall {
        final File file;
        final RequestConfig request;

        PendingInstall(File file, RequestConfig request) {
            this.file = file;
            this.request = request;
        }
    }

    private static final class UpdateException extends Exception {
        final String code;

        UpdateException(String code, String message) {
            super(message);
            this.code = code;
        }
    }
}
