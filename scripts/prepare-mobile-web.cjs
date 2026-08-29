const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(repoRoot, 'apps', 'web', 'dist');
const targetDir = path.join(repoRoot, 'apps', 'mobile', 'www');
const androidWebDir = path.join(
  repoRoot,
  'apps',
  'mobile',
  'android',
  'app',
  'src',
  'main',
  'assets',
  'public',
);
const androidMainActivityPath = path.join(
  repoRoot,
  'apps',
  'mobile',
  'android',
  'app',
  'src',
  'main',
  'java',
  'com',
  'xmlga',
  'nianlun',
  'MainActivity.java',
);
const androidNativeExportPluginPath = path.join(
  repoRoot,
  'apps',
  'mobile',
  'android',
  'app',
  'src',
  'main',
  'java',
  'com',
  'xmlga',
  'nianlun',
  'NativeExportPlugin.java',
);
const androidBuildGradlePath = path.join(repoRoot, 'apps', 'mobile', 'android', 'app', 'build.gradle');
const androidRootBuildGradlePath = path.join(repoRoot, 'apps', 'mobile', 'android', 'build.gradle');
const androidManifestPath = path.join(repoRoot, 'apps', 'mobile', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const androidNativeSourceDir = path.join(repoRoot, 'apps', 'mobile', 'native', 'android');
const androidNativeLocationPluginPath = path.join(path.dirname(androidMainActivityPath), 'NativeLocationPlugin.java');
const androidNativeUpdaterPluginPath = path.join(path.dirname(androidMainActivityPath), 'AppUpdaterPlugin.java');
const androidHmsPushBridgePath = path.join(path.dirname(androidMainActivityPath), 'HmsPushBridgePlugin.java');
const androidHmsMessageServicePath = path.join(path.dirname(androidMainActivityPath), 'NianlunHmsMessageService.java');
const androidNotificationIconPath = path.join(repoRoot, 'apps', 'mobile', 'android', 'app', 'src', 'main', 'res', 'drawable', 'ic_stat_nianlun.xml');
const androidFilePathsPath = path.join(repoRoot, 'apps', 'mobile', 'android', 'app', 'src', 'main', 'res', 'xml', 'file_paths.xml');
const androidActivityLayoutPath = path.join(repoRoot, 'apps', 'mobile', 'android', 'app', 'src', 'main', 'res', 'layout', 'activity_main.xml');
const androidStylesPath = path.join(repoRoot, 'apps', 'mobile', 'android', 'app', 'src', 'main', 'res', 'values', 'styles.xml');
const iosAppDelegatePath = path.join(repoRoot, 'apps', 'mobile', 'ios', 'App', 'App', 'AppDelegate.swift');
const iosInfoPlistPath = path.join(repoRoot, 'apps', 'mobile', 'ios', 'App', 'App', 'Info.plist');
const iosProjectPath = path.join(repoRoot, 'apps', 'mobile', 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
const iosLaunchScreenPath = path.join(repoRoot, 'apps', 'mobile', 'ios', 'App', 'App', 'Base.lproj', 'LaunchScreen.storyboard');
const mobileApiBaseUrl = process.env.VITE_MOBILE_API_BASE_URL ?? 'https://webapi.xmlga.top/api/v1';
const mobilePackage = JSON.parse(fs.readFileSync(path.join(repoRoot, 'apps', 'mobile', 'package.json'), 'utf8'));
const androidBuildGradle = fs.existsSync(androidBuildGradlePath)
  ? fs.readFileSync(androidBuildGradlePath, 'utf8')
  : '';
const androidVersionCode = /versionCode\s+(\d+)/.exec(androidBuildGradle)?.[1] ?? '';
const configuredBuildNumber = mobilePackage.buildNumber === undefined ? '' : String(mobilePackage.buildNumber);
const appVersion = process.env.VITE_APP_VERSION ?? mobilePackage.version ?? '2.0.1';
const appBuildNumber = process.env.VITE_APP_BUILD_NUMBER ?? (configuredBuildNumber || androidVersionCode);
const appBuildTime = process.env.VITE_APP_BUILD_TIME ?? new Date().toISOString();
const nativeBuildNumber = Number.parseInt(appBuildNumber, 10);
const hasNativeBuildNumber = Number.isFinite(nativeBuildNumber) && nativeBuildNumber > 0;
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const appDarkColor = '#F7F4EE';

const writeIfChanged = (filePath, nextSource, label) => {
  const currentSource = fs.readFileSync(filePath, 'utf8');
  if (nextSource === currentSource) return false;
  fs.writeFileSync(filePath, nextSource);
  console.log(`${label}: ${filePath}`);
  return true;
};

const writeFileIfChanged = (filePath, nextSource, label) => {
  const currentSource = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  if (nextSource === currentSource) return false;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, nextSource);
  console.log(`${label}: ${filePath}`);
  return true;
};

const ensureAndroidStyleItems = (source, styleName, items) =>
  source.replace(
    new RegExp(`(<style name="${styleName}"[\\s\\S]*?>)([\\s\\S]*?)(\\n\\s*</style>)`),
    (styleBlock, styleOpen, styleBody, styleClose) => {
      let nextBody = styleBody;
      for (const [name] of items) {
        const itemPattern = new RegExp(`\\n\\s*<item name="${name}">[\\s\\S]*?</item>`, 'g');
        nextBody = nextBody.replace(itemPattern, '');
      }

      const itemLines = items.map(([name, value]) => `        <item name="${name}">${value}</item>`).join('\n');
      return `${styleOpen}${nextBody}\n${itemLines}${styleClose}`;
    },
  );

const patchAndroidNativeVersion = () => {
  if (!fs.existsSync(androidBuildGradlePath)) return;

  const currentSource = fs.readFileSync(androidBuildGradlePath, 'utf8');
  let nextSource = currentSource.replace(/versionName\s+"[^"]+"/, `versionName "${appVersion}"`);
  if (hasNativeBuildNumber) {
    nextSource = nextSource.replace(/versionCode\s+\d+/, `versionCode ${nativeBuildNumber}`);
  }

  writeIfChanged(androidBuildGradlePath, nextSource, 'Android app version patched');
};

const patchIosNativeVersion = () => {
  if (!fs.existsSync(iosProjectPath)) return;

  const currentSource = fs.readFileSync(iosProjectPath, 'utf8');
  let nextSource = currentSource.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${appVersion};`);
  if (hasNativeBuildNumber) {
    nextSource = nextSource.replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${nativeBuildNumber};`);
  }

  writeIfChanged(iosProjectPath, nextSource, 'iOS app version patched');
};

const patchAndroidSystemBars = () => {
  if (!fs.existsSync(androidMainActivityPath)) return;

  const currentSource = fs.readFileSync(androidMainActivityPath, 'utf8');
  let nextSource = currentSource;

  if (!nextSource.includes('import android.view.WindowInsetsController;')) {
    nextSource = nextSource.replace('import android.view.Window;\n', 'import android.view.Window;\nimport android.view.WindowInsetsController;\n');
  }
  if (!nextSource.includes('import android.view.WindowManager;')) {
    nextSource = nextSource.replace('import android.view.WindowInsetsController;\n', 'import android.view.WindowInsetsController;\nimport android.view.WindowManager;\n');
  }

  if (!nextSource.includes('APP_STATUS_BAR_COLOR')) {
    nextSource = nextSource.replace(
      'public class MainActivity extends BridgeActivity {\n',
      `public class MainActivity extends BridgeActivity {
    private static final int APP_STATUS_BAR_COLOR = Color.parseColor("${appDarkColor}");
    private static final int APP_NAVIGATION_BAR_COLOR = Color.parseColor("${appDarkColor}");

`,
    );
  }

  nextSource = nextSource
    .replace(/private static final int APP_STATUS_BAR_COLOR = Color\.parseColor\("#[0-9A-Fa-f]{6}"\);/g, `private static final int APP_STATUS_BAR_COLOR = Color.parseColor("${appDarkColor}");`)
    .replace(/private static final int APP_NAVIGATION_BAR_COLOR = Color\.parseColor\("#[0-9A-Fa-f]{6}"\);/g, `private static final int APP_NAVIGATION_BAR_COLOR = Color.parseColor("${appDarkColor}");`)
    .replace(/Color\.parseColor\("#(?:F1E9DC|FFFDF9|111210|050918|15110D|10110F|0D0B08)"\)/gi, `Color.parseColor("${appDarkColor}")`)
    .replace('window.setNavigationBarColor(Color.parseColor("#fffaf2"));', 'window.setNavigationBarColor(APP_NAVIGATION_BAR_COLOR);')
    .replace('window.setNavigationBarColor(Color.parseColor("#050a1a"));', 'window.setNavigationBarColor(APP_NAVIGATION_BAR_COLOR);')
    .replace('window.setStatusBarColor(Color.TRANSPARENT);', 'window.setStatusBarColor(APP_STATUS_BAR_COLOR);')
    .replace(`window.setStatusBarColor(Color.parseColor("${appDarkColor}"));`, 'window.setStatusBarColor(APP_STATUS_BAR_COLOR);')
    .replace(`window.setNavigationBarColor(Color.parseColor("${appDarkColor}"));`, 'window.setNavigationBarColor(APP_NAVIGATION_BAR_COLOR);')
    .replace('flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;', 'flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;')
    .replace('flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;', 'flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;')
    .replace('window.getInsetsController().setSystemBarsAppearance(0, lightSystemBars);', 'window.getInsetsController().setSystemBarsAppearance(lightSystemBars, lightSystemBars);')
    .replace(
      `            int lightSystemBars =
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                            | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            window.getInsetsController().setSystemBarsAppearance(lightSystemBars, lightSystemBars);
`,
      `            int lightSystemBars =
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                            | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            window.getInsetsController().setSystemBarsAppearance(lightSystemBars, lightSystemBars);
`,
    );

  if (!nextSource.includes('WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS')) {
    nextSource = nextSource.replace(
      '        window.getDecorView().setSystemUiVisibility(flags);\n',
      `        window.getDecorView().setSystemUiVisibility(flags);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && window.getInsetsController() != null) {
            int lightSystemBars =
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                            | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            window.getInsetsController().setSystemBarsAppearance(lightSystemBars, lightSystemBars);
        }
`,
    );
  }

  if (!nextSource.includes('window.setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(APP_STATUS_BAR_COLOR));')) {
    nextSource = nextSource.replace(
      '        Window window = getWindow();\n',
      '        Window window = getWindow();\n        window.setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(APP_STATUS_BAR_COLOR));\n',
    );
  }
  nextSource = nextSource.replace(
    /\s*if \(Build\.VERSION\.SDK_INT >= Build\.VERSION_CODES\.R\) \{\s*window\.setDecorFitsSystemWindows\((?:true|false)\);\s*\}/g,
    '',
  );
  nextSource = nextSource.replace(/\s*if \(Build\.VERSION\.SDK_INT >= Build\.VERSION_CODES\.R\) \{\s*\}/g, '');
  nextSource = nextSource.replace(
    '        Window window = getWindow();\n',
    '        Window window = getWindow();\n        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {\n            window.setDecorFitsSystemWindows(true);\n        }\n',
  );
  if (!nextSource.includes('FLAG_TRANSLUCENT_STATUS')) {
    nextSource = nextSource.replace(
      '        Window window = getWindow();\n',
      '        Window window = getWindow();\n        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS | WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);\n        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);\n',
    );
  }

  if (!nextSource.includes('webView.setBackgroundColor(APP_STATUS_BAR_COLOR);')) {
    nextSource = nextSource.replace(
      '        WebView webView = getBridge().getWebView();\n',
      '        WebView webView = getBridge().getWebView();\n        webView.setBackgroundColor(APP_STATUS_BAR_COLOR);\n',
    );
  }
  if (!nextSource.includes('webView.getRootView().setBackgroundColor(APP_STATUS_BAR_COLOR);')) {
    nextSource = nextSource.replace(
      '        webView.setBackgroundColor(APP_STATUS_BAR_COLOR);\n',
      '        webView.setBackgroundColor(APP_STATUS_BAR_COLOR);\n        webView.getRootView().setBackgroundColor(APP_STATUS_BAR_COLOR);\n',
    );
  }

  if (!nextSource.includes('configureSystemBars();\n        registerPlugin(NativeLocationPlugin.class);')) {
    nextSource = nextSource.replace(
      '        registerPlugin(NativeLocationPlugin.class);\n',
      '        configureSystemBars();\n        registerPlugin(NativeLocationPlugin.class);\n',
    );
  }

  nextSource = nextSource.replace('protected void onResume()', 'public void onResume()');

  if (!nextSource.includes('void onResume()')) {
    nextSource = nextSource.replace(
      '\n    private void configureSystemBars() {',
      `
    @Override
    public void onResume() {
        super.onResume();
        configureSystemBars();

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.setBackgroundColor(APP_STATUS_BAR_COLOR);
            webView.getRootView().setBackgroundColor(APP_STATUS_BAR_COLOR);
        }
    }

    private void configureSystemBars() {`,
    );
  }

  nextSource = nextSource.replace(/        flags \|= View\.SYSTEM_UI_FLAG_LAYOUT_STABLE \| View\.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN \| View\.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;\n/g, '');
  nextSource = nextSource.replace(/        flags \|= View\.SYSTEM_UI_FLAG_LAYOUT_STABLE;\n/g, '');
  nextSource = nextSource.replace(/        flags &= ~\(View\.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN \| View\.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION\);\n/g, '');
  nextSource = nextSource.replace(
    '        window.getDecorView().setSystemUiVisibility(flags);\n',
    '        flags |= View.SYSTEM_UI_FLAG_LAYOUT_STABLE;\n        flags &= ~(View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);\n        window.getDecorView().setSystemUiVisibility(flags);\n',
  );

  writeIfChanged(androidMainActivityPath, nextSource, 'Android system bars patched for light UI');
};

const patchAndroidNativeLocation = () => {
  if (!fs.existsSync(androidMainActivityPath)) return;

  const templatePath = path.join(androidNativeSourceDir, 'NativeLocationPlugin.java');
  if (!fs.existsSync(templatePath)) throw new Error(`Missing Android native template: ${templatePath}`);
  writeFileIfChanged(
    androidNativeLocationPluginPath,
    fs.readFileSync(templatePath, 'utf8'),
    'Android native location plugin synced',
  );

  const currentActivitySource = fs.readFileSync(androidMainActivityPath, 'utf8');
  if (!currentActivitySource.includes('registerPlugin(NativeLocationPlugin.class);')) {
    const nextActivitySource = currentActivitySource.replace(
      '        super.onCreate(savedInstanceState);\n',
      '        registerPlugin(NativeLocationPlugin.class);\n        super.onCreate(savedInstanceState);\n',
    );
    if (nextActivitySource === currentActivitySource) {
      throw new Error(`Unable to register NativeLocationPlugin in ${androidMainActivityPath}`);
    }
    writeIfChanged(androidMainActivityPath, nextActivitySource, 'Android native location plugin registered');
  }

  if (!fs.existsSync(androidManifestPath)) return;
  const locationPermissions = [
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.ACCESS_FINE_LOCATION',
  ];
  let nextManifest = fs.readFileSync(androidManifestPath, 'utf8');
  for (const permission of locationPermissions) {
    if (!nextManifest.includes(permission)) {
      nextManifest = nextManifest.replace(
        '</manifest>',
        `    <uses-permission android:name="${permission}" />\n</manifest>`,
      );
    }
  }
  writeIfChanged(androidManifestPath, nextManifest, 'Android location permissions patched');
};

const patchAndroidNativeExportPlugin = () => {
  if (!fs.existsSync(androidMainActivityPath)) return;

  const pluginSource = `package com.xmlga.nianlun;

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
        String safeFileName = fileName.replaceAll("[\\\\\\\\/:*?\\\"<>|\\\\r\\\\n]+", "-").trim();
        return safeFileName.isEmpty() ? DEFAULT_FILE_NAME : safeFileName;
    }
}
`;

  writeFileIfChanged(androidNativeExportPluginPath, pluginSource, 'Android native export plugin patched');

  const currentSource = fs.readFileSync(androidMainActivityPath, 'utf8');
  if (currentSource.includes('registerPlugin(NativeExportPlugin.class);')) return;
  const nextSource = currentSource.replace(
    '        registerPlugin(NativeLocationPlugin.class);\n',
    '        registerPlugin(NativeLocationPlugin.class);\n        registerPlugin(NativeExportPlugin.class);\n',
  );
  writeIfChanged(androidMainActivityPath, nextSource, 'Android native export plugin registered');
};

const patchAndroidAppUpdaterPlugin = () => {
  if (!fs.existsSync(androidMainActivityPath)) return;

  const pluginTemplatePath = path.join(androidNativeSourceDir, 'AppUpdaterPlugin.java');
  if (!fs.existsSync(pluginTemplatePath)) {
    throw new Error(`Missing Android native template: ${pluginTemplatePath}`);
  }
  writeFileIfChanged(
    androidNativeUpdaterPluginPath,
    fs.readFileSync(pluginTemplatePath, 'utf8'),
    'Android app updater plugin synced',
  );

  let activitySource = fs.readFileSync(androidMainActivityPath, 'utf8');
  if (!activitySource.includes('registerPlugin(AppUpdaterPlugin.class);')) {
    const registrationAnchor = activitySource.includes('        registerPlugin(NativeExportPlugin.class);')
      ? '        registerPlugin(NativeExportPlugin.class);\n'
      : '        registerPlugin(NativeLocationPlugin.class);\n';
    const nextActivitySource = activitySource.replace(
      registrationAnchor,
      `${registrationAnchor}        registerPlugin(AppUpdaterPlugin.class);\n`,
    );
    if (nextActivitySource === activitySource) {
      throw new Error(`Unable to register AppUpdaterPlugin in ${androidMainActivityPath}`);
    }
    activitySource = nextActivitySource;
  }
  writeIfChanged(androidMainActivityPath, activitySource, 'Android app updater plugin registered');

  if (fs.existsSync(androidManifestPath)) {
    let manifest = fs.readFileSync(androidManifestPath, 'utf8');
    if (!manifest.includes('android.permission.REQUEST_INSTALL_PACKAGES')) {
      manifest = manifest.replace(
        '</manifest>',
        '    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n</manifest>',
      );
    }
    if (!manifest.includes('androidx.core.content.FileProvider')) {
      const providerBlock = `
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
`;
      manifest = manifest.replace('    </application>', `${providerBlock}    </application>`);
    }
    writeIfChanged(androidManifestPath, manifest, 'Android app updater manifest patched');
  }

  const filePathsTemplatePath = path.join(androidNativeSourceDir, 'file_paths.xml');
  if (fs.existsSync(androidFilePathsPath)) {
    let filePaths = fs.readFileSync(androidFilePathsPath, 'utf8');
    if (!filePaths.includes('name="update_cache"')) {
      filePaths = filePaths.replace(
        '</paths>',
        '    <cache-path name="update_cache" path="updates/" />\n</paths>',
      );
      writeIfChanged(androidFilePathsPath, filePaths, 'Android update cache path patched');
    }
  } else if (fs.existsSync(filePathsTemplatePath)) {
    writeFileIfChanged(
      androidFilePathsPath,
      fs.readFileSync(filePathsTemplatePath, 'utf8'),
      'Android FileProvider paths synced',
    );
  }
};

const patchAndroidHuaweiPush = () => {
  if (!fs.existsSync(androidMainActivityPath)) return;

  for (const [templateName, targetPath] of [
    ['HmsPushBridgePlugin.java', androidHmsPushBridgePath],
    ['NianlunHmsMessageService.java', androidHmsMessageServicePath],
    ['ic_stat_nianlun.xml', androidNotificationIconPath],
  ]) {
    const templatePath = path.join(androidNativeSourceDir, templateName);
    if (!fs.existsSync(templatePath)) throw new Error(`Missing Android native template: ${templatePath}`);
    writeFileIfChanged(targetPath, fs.readFileSync(templatePath, 'utf8'), `Android ${templateName} synced`);
  }

  let activitySource = fs.readFileSync(androidMainActivityPath, 'utf8');
  if (!activitySource.includes('import android.app.NotificationChannel;')) {
    activitySource = activitySource.replace(
      'package com.xmlga.nianlun;\n\n',
      'package com.xmlga.nianlun;\n\nimport android.app.NotificationChannel;\nimport android.app.NotificationManager;\nimport android.content.Context;\n',
    );
  }
  if (!activitySource.includes('FAMILY_NOTIFICATION_CHANNEL_ID')) {
    activitySource = activitySource.replace(
      'public class MainActivity extends BridgeActivity {\n',
      'public class MainActivity extends BridgeActivity {\n    private static final String FAMILY_NOTIFICATION_CHANNEL_ID = "nianlun_family_updates";\n',
    );
  }
  if (!activitySource.includes('registerPlugin(HmsPushBridgePlugin.class);')) {
    activitySource = activitySource.replace(
      '        registerPlugin(NativeExportPlugin.class);\n',
      '        registerPlugin(NativeExportPlugin.class);\n        registerPlugin(HmsPushBridgePlugin.class);\n',
    );
  }
  if (!activitySource.includes('createFamilyNotificationChannel();')) {
    activitySource = activitySource.replace(
      '        super.onCreate(savedInstanceState);\n',
      '        super.onCreate(savedInstanceState);\n        createFamilyNotificationChannel();\n',
    );
  }
  if (!activitySource.includes('private void createFamilyNotificationChannel()')) {
    activitySource = activitySource.replace(
      '    private void hideSupportActionBar() {',
      `    private void createFamilyNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        NotificationChannel channel = new NotificationChannel(
                FAMILY_NOTIFICATION_CHANNEL_ID,
                "家庭动态",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("家庭成员发布记录时提醒");
        channel.enableVibration(true);
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
        manager.createNotificationChannel(channel);
    }

    private void hideSupportActionBar() {`,
    );
  }
  writeIfChanged(androidMainActivityPath, activitySource, 'Android Huawei Push activity patched');

  if (fs.existsSync(androidRootBuildGradlePath)) {
    let rootGradle = fs.readFileSync(androidRootBuildGradlePath, 'utf8');
    if (!rootGradle.includes("classpath 'com.huawei.agconnect:agcp:")) {
      rootGradle = rootGradle.replace(
        "        classpath 'com.google.gms:google-services:4.4.2'",
        "        classpath 'com.google.gms:google-services:4.4.2'\n        classpath 'com.huawei.agconnect:agcp:1.9.3.300'",
      );
    }
    if (!rootGradle.includes("maven { url 'https://developer.huawei.com/repo/' }")) {
      rootGradle = rootGradle.replace(/(\s+)mavenCentral\(\)/g, "$&$1maven { url 'https://developer.huawei.com/repo/' }");
    }
    writeIfChanged(androidRootBuildGradlePath, rootGradle, 'Android Huawei repository patched');
  }

  if (fs.existsSync(androidBuildGradlePath)) {
    let appGradle = fs.readFileSync(androidBuildGradlePath, 'utf8');
    if (!appGradle.includes("implementation 'com.huawei.hms:push:")) {
      appGradle = appGradle.replace(
        "    implementation project(':capacitor-cordova-android-plugins')",
        "    implementation project(':capacitor-cordova-android-plugins')\n    implementation 'com.huawei.hms:push:6.12.0.300'",
      );
    }
    if (!appGradle.includes("apply plugin: 'com.huawei.agconnect'")) {
      appGradle = appGradle.replace(
        "try {\n    def servicesJSON",
        "if (file('agconnect-services.json').exists()) {\n    apply plugin: 'com.huawei.agconnect'\n}\n\ntry {\n    def servicesJSON",
      );
    }
    writeIfChanged(androidBuildGradlePath, appGradle, 'Android Huawei Push dependency patched');
  }

  if (fs.existsSync(androidManifestPath)) {
    let manifest = fs.readFileSync(androidManifestPath, 'utf8');
    if (!manifest.includes('.NianlunHmsMessageService')) {
      manifest = manifest.replace(
        '    </application>',
        `        <service
            android:name=".NianlunHmsMessageService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.huawei.push.action.MESSAGING_EVENT" />
            </intent-filter>
        </service>
    </application>`,
      );
    }
    if (!manifest.includes('android.permission.POST_NOTIFICATIONS')) {
      manifest = manifest.replace(
        '</manifest>',
        '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n</manifest>',
      );
    }
    writeIfChanged(androidManifestPath, manifest, 'Android Huawei Push manifest patched');
  }
};

const patchAndroidWindowBackgrounds = () => {
  if (fs.existsSync(androidActivityLayoutPath)) {
    let nextLayout = fs.readFileSync(androidActivityLayoutPath, 'utf8');
    nextLayout = nextLayout.replace(/android:background="#(?:F8F8F4|F1E9DC|FFFDF9|111210|050918|15110d|10110f|0d0b08)"/gi, `android:background="${appDarkColor}"`);
    if (!nextLayout.includes(`android:background="${appDarkColor}"`)) {
      nextLayout = nextLayout.replace(
        '    android:layout_height="match_parent"\n    tools:context=".MainActivity">',
        `    android:layout_height="match_parent"\n    android:background="${appDarkColor}"\n    tools:context=".MainActivity">`,
      );
    }
    nextLayout = nextLayout.replace(
      /(<WebView[\s\S]*?android:layout_height="match_parent")\s*\/>/,
      `$1\n        android:background="${appDarkColor}" />`,
    );
    writeIfChanged(androidActivityLayoutPath, nextLayout, 'Android root background patched for light UI');
  }

  if (fs.existsSync(androidStylesPath)) {
    let nextStyles = fs.readFileSync(androidStylesPath, 'utf8');
    nextStyles = nextStyles
      .replace(/#(?:F8F8F4|10110F|15110D|111210|050918|0D0B08)/gi, appDarkColor)
      .replace(/<item name="android:windowLightStatusBar">false<\/item>/g, '<item name="android:windowLightStatusBar">true</item>')
      .replace(/<item name="android:windowLightNavigationBar">false<\/item>/g, '<item name="android:windowLightNavigationBar">true</item>');
    nextStyles = ensureAndroidStyleItems(nextStyles, 'AppTheme.NoActionBar', [
      ['android:background', appDarkColor],
      ['android:windowBackground', appDarkColor],
      ['android:colorBackground', appDarkColor],
      ['android:statusBarColor', appDarkColor],
      ['android:navigationBarColor', appDarkColor],
      ['android:windowLightStatusBar', 'true'],
      ['android:windowLightNavigationBar', 'true'],
      ['android:forceDarkAllowed', 'false'],
      ['android:windowDrawsSystemBarBackgrounds', 'true'],
      ['android:enforceStatusBarContrast', 'false'],
      ['android:enforceNavigationBarContrast', 'false'],
      ['android:windowOptOutEdgeToEdgeEnforcement', 'true'],
    ]);
    nextStyles = ensureAndroidStyleItems(nextStyles, 'AppTheme.NoActionBarLaunch', [
      ['android:background', '@drawable/splash_dark'],
      ['windowSplashScreenBackground', appDarkColor],
      ['android:windowBackground', appDarkColor],
      ['android:colorBackground', appDarkColor],
      ['android:statusBarColor', appDarkColor],
      ['android:navigationBarColor', appDarkColor],
      ['android:windowLightStatusBar', 'true'],
      ['android:windowLightNavigationBar', 'true'],
      ['android:forceDarkAllowed', 'false'],
      ['android:windowDrawsSystemBarBackgrounds', 'true'],
      ['android:enforceStatusBarContrast', 'false'],
      ['android:enforceNavigationBarContrast', 'false'],
      ['android:windowOptOutEdgeToEdgeEnforcement', 'true'],
    ]);
    writeIfChanged(androidStylesPath, nextStyles, 'Android theme background patched for light UI');
  }
};

const patchIosWindowBackgrounds = () => {
  if (fs.existsSync(iosInfoPlistPath)) {
    let nextPlist = fs.readFileSync(iosInfoPlistPath, 'utf8');
    nextPlist = nextPlist.replace('<key>UIViewControllerBasedStatusBarAppearance</key>\n\t<true/>', '<key>UIViewControllerBasedStatusBarAppearance</key>\n\t<false/>');
    nextPlist = nextPlist.replace('UIStatusBarStyleLightContent', 'UIStatusBarStyleDarkContent');
    if (!nextPlist.includes('<key>UIStatusBarStyle</key>')) {
      nextPlist = nextPlist.replace(
        '<key>UIViewControllerBasedStatusBarAppearance</key>\n\t<false/>',
        '<key>UIViewControllerBasedStatusBarAppearance</key>\n\t<false/>\n\t<key>UIStatusBarStyle</key>\n\t<string>UIStatusBarStyleDarkContent</string>',
      );
    }
    writeIfChanged(iosInfoPlistPath, nextPlist, 'iOS status bar patched for light UI');
  }

  if (fs.existsSync(iosAppDelegatePath)) {
    let nextDelegate = fs.readFileSync(iosAppDelegatePath, 'utf8');
    if (!nextDelegate.includes('appBackgroundColor')) {
      nextDelegate = nextDelegate.replace(
        '    var window: UIWindow?\n',
        '    var window: UIWindow?\n    private let appBackgroundColor = UIColor(red: 248 / 255, green: 244 / 255, blue: 236 / 255, alpha: 1)\n',
      );
    }
    nextDelegate = nextDelegate
      .replace(/private let appBackgroundColor = UIColor\(red: \d+ \/ 255, green: \d+ \/ 255, blue: \d+ \/ 255, alpha: 1\)/, 'private let appBackgroundColor = UIColor(red: 248 / 255, green: 244 / 255, blue: 236 / 255, alpha: 1)')
      .replace('UIApplication.shared.statusBarStyle = .lightContent', 'UIApplication.shared.statusBarStyle = .darkContent')
      .replace('window?.overrideUserInterfaceStyle = .dark', 'window?.overrideUserInterfaceStyle = .light');
    nextDelegate = nextDelegate.replace(
      '        // Override point for customization after application launch.\n        return true',
      '        configureWindowAppearance()\n        return true',
    );
    nextDelegate = nextDelegate.replace(
      '        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.',
      '        configureWindowAppearance()',
    );
    if (!nextDelegate.includes('private func configureWindowAppearance()')) {
      nextDelegate = nextDelegate.replace(
        '\n}\n',
        `
    private func configureWindowAppearance() {
        window?.backgroundColor = appBackgroundColor
        window?.rootViewController?.view.backgroundColor = appBackgroundColor
        UIApplication.shared.statusBarStyle = .darkContent
        if #available(iOS 13.0, *) {
            window?.overrideUserInterfaceStyle = .light
        }
    }
}
`,
      );
    }
    writeIfChanged(iosAppDelegatePath, nextDelegate, 'iOS window background patched for light UI');
  }

  if (fs.existsSync(iosLaunchScreenPath)) {
    let nextLaunchScreen = fs.readFileSync(iosLaunchScreenPath, 'utf8');
    nextLaunchScreen = nextLaunchScreen
      .replace('<color key="backgroundColor" systemColor="systemBackgroundColor"/>', '<color key="backgroundColor" red="0.9450980392156862" green="0.9137254901960784" blue="0.8627450980392157" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>')
      .replace(/<color key="backgroundColor" red="0\.062745098039215685" green="0\.066666666666666666" blue="0\.058823529411764705" alpha="1" colorSpace="custom" customColorSpace="sRGB"\/>/, '<color key="backgroundColor" red="0.9450980392156862" green="0.9137254901960784" blue="0.8627450980392157" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>')
      .replace(/\n        <systemColor name="systemBackgroundColor">\n            <color white="1" alpha="1" colorSpace="custom" customColorSpace="genericGamma22GrayColorSpace"\/>\n        <\/systemColor>/, '');
    writeIfChanged(iosLaunchScreenPath, nextLaunchScreen, 'iOS launch background patched for light UI');
  }
};

const buildResult = spawnSync(npmCommand, ['run', 'build', '-w', 'apps/web'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    VITE_API_BASE_URL: mobileApiBaseUrl,
    VITE_APP_VERSION: appVersion,
    VITE_APP_BUILD_NUMBER: appBuildNumber,
    VITE_APP_BUILD_TIME: appBuildTime,
  },
});

if (buildResult.error) {
  console.error(buildResult.error);
  process.exit(1);
}

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

if (!fs.existsSync(sourceDir)) {
  throw new Error('apps/web/dist does not exist after the mobile web build');
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });
if (fs.existsSync(path.dirname(androidWebDir))) {
  fs.rmSync(path.join(androidWebDir, 'assets'), { recursive: true, force: true });
  fs.mkdirSync(androidWebDir, { recursive: true });
  fs.cpSync(targetDir, androidWebDir, { recursive: true });
  console.log(`Android web assets synced: ${androidWebDir}`);
}
patchAndroidNativeVersion();
patchIosNativeVersion();
patchAndroidNativeLocation();
patchAndroidSystemBars();
patchAndroidNativeExportPlugin();
patchAndroidAppUpdaterPlugin();
patchAndroidHuaweiPush();
patchAndroidWindowBackgrounds();
patchIosWindowBackgrounds();

console.log(`Mobile web assets prepared with ${mobileApiBaseUrl}, version ${appVersion} (${appBuildNumber || 'dev'}): ${targetDir}`);
