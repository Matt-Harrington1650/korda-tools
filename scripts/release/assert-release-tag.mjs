import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const packageJsonPath = path.join(repoRoot, 'package.json');
const changelogPath = path.join(repoRoot, 'CHANGELOG.md');

function extractVersionSection(changelog, version) {
  const marker = `## [${version}]`;
  const start = changelog.indexOf(marker);
  if (start === -1) {
    throw new Error(
      `CHANGELOG.md is missing a section for version ${version}. Add "## [${version}] - YYYY-MM-DD".`,
    );
  }
  const afterStart = changelog.slice(start);
  const nextHeading = afterStart.indexOf('\n## [', marker.length);
  return nextHeading === -1 ? afterStart.trim() : afterStart.slice(0, nextHeading).trim();
}

function setGitHubOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    return;
  }
  const serialized = String(value).replace(/\r/g, '');
  const lines =
    serialized.includes('\n')
      ? `${name}<<EOF\n${serialized}\nEOF\n`
      : `${name}=${serialized}\n`;
  return fs.appendFile(outputPath, lines, 'utf8');
}

async function main() {
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  const version = String(packageJson.version ?? '').trim();
  const refName = String(process.env.GITHUB_REF_NAME ?? process.argv[2] ?? '').trim();
  const expectedTag = `v${version}`;

  if (!refName) {
    throw new Error('Release tag is required. Expected a tag like v0.1.0.');
  }
  if (refName !== expectedTag) {
    throw new Error(
      `Release tag ${refName} does not match package.json version ${version}. Expected ${expectedTag}.`,
    );
  }

  const changelog = await fs.readFile(changelogPath, 'utf8');
  const releaseNotes = extractVersionSection(changelog, version);
  const prerelease = version.includes('-');

  await setGitHubOutput('version', version);
  await setGitHubOutput('tag', expectedTag);
  await setGitHubOutput('prerelease', prerelease ? 'true' : 'false');
  await setGitHubOutput('release_name', `Korda Tools ${expectedTag}`);
  await setGitHubOutput('release_notes', releaseNotes);

  process.stdout.write(
    `Release tag ${expectedTag} matches package.json version ${version}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
