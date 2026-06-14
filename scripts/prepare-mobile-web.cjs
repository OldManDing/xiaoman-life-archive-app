const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(repoRoot, 'apps', 'web', 'dist');
const targetDir = path.join(repoRoot, 'apps', 'mobile', 'www');
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
const mobileApiBaseUrl = process.env.VITE_MOBILE_API_BASE_URL ?? 'https://webapi.xmlga.top/api/v1';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const patchAndroidSystemBars = () => {
  if (!fs.existsSync(androidMainActivityPath)) return;

  const currentSource = fs.readFileSync(androidMainActivityPath, 'utf8');
  let nextSource = currentSource;

  if (!nextSource.includes('import android.view.WindowInsetsController;')) {
    nextSource = nextSource.replace('import android.view.Window;\n', 'import android.view.Window;\nimport android.view.WindowInsetsController;\n');
  }

  nextSource = nextSource
    .replace('window.setNavigationBarColor(Color.parseColor("#fffaf2"));', 'window.setNavigationBarColor(Color.parseColor("#050918"));')
    .replace('window.setNavigationBarColor(Color.parseColor("#050a1a"));', 'window.setNavigationBarColor(Color.parseColor("#050918"));')
    .replace('flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;', 'flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;')
    .replace('flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;', 'flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;')
    .replace(
      `            int lightSystemBars =
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                            | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            window.getInsetsController().setSystemBarsAppearance(lightSystemBars, lightSystemBars);
`,
      `            int lightSystemBars =
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                            | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            window.getInsetsController().setSystemBarsAppearance(0, lightSystemBars);
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
            window.getInsetsController().setSystemBarsAppearance(0, lightSystemBars);
        }
`,
    );
  }

  if (nextSource !== currentSource) {
    fs.writeFileSync(androidMainActivityPath, nextSource);
    console.log(`Android system bars patched for dark UI: ${androidMainActivityPath}`);
  }
};

const buildResult = spawnSync(npmCommand, ['run', 'build', '-w', 'apps/web'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    VITE_API_BASE_URL: mobileApiBaseUrl,
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
patchAndroidSystemBars();

console.log(`Mobile web assets prepared with ${mobileApiBaseUrl}: ${targetDir}`);
