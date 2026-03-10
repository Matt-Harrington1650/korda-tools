import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const packageJsonPath = path.join(repoRoot, 'package.json');
const cargoTomlPath = path.join(repoRoot, 'src-tauri', 'Cargo.toml');
const tauriConfigPath = path.join(repoRoot, 'src-tauri', 'tauri.conf.json');

const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function ensureSemver(version) {
  if (!semverPattern.test(version)) {
    throw new Error(
      `package.json version "${version}" is not a valid SemVer string.`,
    );
  }
}

function normalizeBoolean(value) {
  return ['1', 'true', 'yes', 'on']
    .includes(String(value ?? '').trim().toLowerCase());
}

function updateCargoVersion(cargoToml, version) {
  const packageSectionPattern = /(\[package\][\s\S]*?^version\s*=\s*")([^"]+)(")/m;
  if (!packageSectionPattern.test(cargoToml)) {
    throw new Error('Could not find [package] version in src-tauri/Cargo.toml.');
  }
  return cargoToml.replace(packageSectionPattern, `$1${version}$3`);
}

async function main() {
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  const version = String(packageJson.version ?? '').trim();
  ensureSemver(version);

  const releaseMode = String(process.env.KORDA_RELEASE_MODE ?? 'internal')
    .trim()
    .toLowerCase();
  const productionRelease = releaseMode === 'production';
  const updaterPublicKey = String(process.env.TAURI_UPDATER_PUBLIC_KEY ?? '').trim();
  const updaterEndpoint = String(
    process.env.TAURI_UPDATER_ENDPOINT ||
      'https://github.com/Matt-Harrington1650/korda-tools/releases/latest/download/latest.json',
  ).trim();
  const enableWindowsSigning = normalizeBoolean(process.env.KORDA_ENABLE_WINDOWS_SIGNING);

  if (productionRelease && updaterPublicKey.length === 0) {
    throw new Error(
      'TAURI_UPDATER_PUBLIC_KEY is required when KORDA_RELEASE_MODE=production.',
    );
  }

  const tauriConfig = JSON.parse(await fs.readFile(tauriConfigPath, 'utf8'));
  tauriConfig.version = '../package.json';
  tauriConfig.bundle = tauriConfig.bundle ?? {};
  tauriConfig.bundle.createUpdaterArtifacts = productionRelease;
  tauriConfig.bundle.targets = ['nsis'];
  tauriConfig.bundle.publisher = 'Matt Harrington';
  tauriConfig.bundle.shortDescription =
    'Desktop engineering workspace for Korda Tools and Sophon operations.';
  tauriConfig.bundle.windows = tauriConfig.bundle.windows ?? {};
  tauriConfig.bundle.windows.webviewInstallMode = {
    type: 'downloadBootstrapper',
    silent: true,
  };

  if (enableWindowsSigning) {
    tauriConfig.bundle.windows.signCommand = {
      cmd: 'powershell',
      args: [
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        path.join(repoRoot, 'scripts', 'release', 'sign-windows.ps1'),
        '%1',
      ],
    };
  } else {
    delete tauriConfig.bundle.windows.signCommand;
  }

  tauriConfig.plugins = tauriConfig.plugins ?? {};
  tauriConfig.plugins.sql = tauriConfig.plugins.sql ?? {
    preload: ['sqlite:korda_tools.db'],
  };

  if (updaterPublicKey.length > 0) {
    tauriConfig.plugins.updater = {
      endpoints: [updaterEndpoint],
      pubkey: updaterPublicKey,
      windows: {
        installMode: 'passive',
      },
    };
  } else {
    delete tauriConfig.plugins.updater;
  }

  await fs.writeFile(
    tauriConfigPath,
    `${JSON.stringify(tauriConfig, null, 2)}\n`,
    'utf8',
  );

  const cargoToml = await fs.readFile(cargoTomlPath, 'utf8');
  const updatedCargoToml = updateCargoVersion(cargoToml, version);
  await fs.writeFile(cargoTomlPath, updatedCargoToml, 'utf8');

  process.stdout.write(
    [
      `Prepared Tauri config for version ${version}.`,
      `Release mode: ${releaseMode}.`,
      `Updater enabled: ${updaterPublicKey.length > 0 ? 'yes' : 'no'}.`,
      `Windows signing enabled: ${enableWindowsSigning ? 'yes' : 'no'}.`,
    ].join('\n'),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
