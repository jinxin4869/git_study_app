import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { arch, platform } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const legalName = name => /^(licen[cs]e|notice|copying|copyright)([._-]|$)/i.test(name);
function legalFiles(root, prefix = '') {
  const files = [];
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    if (entry.isSymbolicLink() || ['node_modules', '.git', '.cache'].includes(entry.name)) continue;
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...legalFiles(root, path));
    else if (entry.isFile() && (legalName(entry.name) || prefix.split(/[\\/]/).some(part => /^licen[cs]es?$/i.test(part)))) files.push(path);
  }
  return files.sort();
}

export function generate(root, profile = `${platform()}-${arch()}`) {
  if (!/^[a-z0-9-]+$/.test(profile)) throw new Error('Invalid profile');
  const lockBytes = readFileSync(join(root, 'package-lock.json'));
  const lock = JSON.parse(lockBytes.toString('utf8'));
  const manifest = { schemaVersion: 1, profile, lockSha256: digest(lockBytes), packages: [], texts: {} };
  for (const [location, item] of Object.entries(lock.packages).filter(([path]) => path).sort(([a], [b]) => a.localeCompare(b))) {
    if (!location.startsWith('node_modules/') || location.split('/').some(part => part === '..' || part === '.')) throw new Error('Invalid locked package path');
    const name = location.split('node_modules/').at(-1);
    const record = { location, name, version: item.version, license: item.license ?? 'UNKNOWN', development: !!item.dev, optional: !!item.optional, resolved: item.resolved, integrity: item.integrity, evidence: 'not-installed', notices: [] };
    const folder = join(root, location);
    if (existsSync(join(folder, 'package.json'))) {
      if (!realpathSync(folder).startsWith(realpathSync(join(root, 'node_modules')) + sep)) throw new Error('Linked package outside node_modules must be reviewed');
      const installed = readJson(join(folder, 'package.json'));
      if (installed.version !== item.version) throw new Error(`Installed version differs from lockfile: ${location}`);
      const files = legalFiles(folder);
      record.evidence = files.length ? 'notices-collected' : 'metadata-only';
      for (const file of files) {
        const bytes = readFileSync(join(folder, file));
        if (bytes.length > 2_000_000 || bytes.includes(0)) throw new Error(`Review non-text/large legal file: ${location}/${file}`);
        const sha256 = digest(bytes);
        const output = `public/licenses/dependency-texts/${sha256}.txt`;
        mkdirSync(dirname(join(root, output)), { recursive: true });
        writeFileSync(join(root, output), bytes);
        manifest.texts[sha256] = { file: output, bytes: bytes.length };
        record.notices.push({ source: `${location}/${file}`, sha256 });
      }
      if (!files.length) {
        const readme = readdirSync(folder).find(name => /^readme(?:\.md|\.txt)?$/i.test(name));
        if (readme) {
          const original = readFileSync(join(folder, readme), 'utf8');
          const start = original.search(/^#{1,6}.*(?:licen[cs](?:e|ing)|credits)|^licen[cs]e\s*$/im);
          if (start >= 0) {
            const bytes = Buffer.from(original.slice(start));
            const sha256 = digest(bytes);
            const output = `public/licenses/dependency-texts/${sha256}.txt`;
            mkdirSync(dirname(join(root, output)), { recursive: true }); writeFileSync(join(root, output), bytes);
            manifest.texts[sha256] = { file: output, bytes: bytes.length };
            record.contexts = [{ source: `${location}/${readme}`, fromLine: original.slice(0, start).split('\n').length, sha256, kind: 'publisher-readme-context-not-a-license-verdict' }];
          }
        }
      }
    }
    manifest.packages.push(record);
  }
  const output = `public/licenses/dependencies/${profile}.json`;
  mkdirSync(dirname(join(root, output)), { recursive: true });
  writeFileSync(join(root, output), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

export function check(root) {
  const lockBytes = readFileSync(join(root, 'package-lock.json'));
  const lock = JSON.parse(lockBytes.toString('utf8'));
  const directory = join(root, 'public/licenses/dependencies');
  const profiles = readdirSync(directory).filter(name => name.endsWith('.json'));
  if (!profiles.length) throw new Error('No recorded dependency profiles');
  for (const profile of profiles) {
    const data = readJson(join(directory, profile));
    if (data.schemaVersion !== 1 || data.lockSha256 !== digest(lockBytes)) throw new Error(`Inventory must be regenerated: ${profile}`);
    const locations = data.packages.map(item => item.location);
    const expected = Object.keys(lock.packages).filter(Boolean).sort();
    if (new Set(locations).size !== expected.length || JSON.stringify([...locations].sort()) !== JSON.stringify(expected)) throw new Error(`Dependency scope differs: ${profile}`);
    for (const item of data.packages) {
      const locked = lock.packages[item.location];
      if (item.version !== locked.version || item.license !== (locked.license ?? 'UNKNOWN') || item.integrity !== locked.integrity || item.resolved !== locked.resolved) throw new Error(`Metadata differs: ${item.location}`);
      if (!['not-installed', 'metadata-only', 'notices-collected'].includes(item.evidence)) throw new Error(`Invalid evidence: ${item.location}`);
      for (const notice of [...item.notices, ...(item.contexts ?? [])]) {
        const text = data.texts[notice.sha256];
        const expectedPath = `public/licenses/dependency-texts/${notice.sha256}.txt`;
        if (!/^[0-9a-f]{64}$/.test(notice.sha256) || text?.file !== expectedPath) throw new Error('Invalid notice path');
        const bytes = readFileSync(join(root, text.file));
        if (bytes.length !== text.bytes || digest(bytes) !== notice.sha256) throw new Error(`Notice changed: ${text.file}`);
      }
    }
  }
  const catalogPath = join(root, 'public/licenses/sources.json');
  if (existsSync(catalogPath)) {
    const catalog = readJson(catalogPath);
    const expectedDirect = Object.keys(readJson(join(root, 'package.json')).dependencies).sort();
    if (JSON.stringify(catalog.packages.map(item => item.name).sort()) !== JSON.stringify(expectedDirect)) throw new Error('Direct dependency catalog scope is stale');
    for (const item of [...catalog.packages, ...catalog.fonts.licenses]) {
      if (!item.file.startsWith('public/licenses/') || item.file.split('/').includes('..') || digest(readFileSync(join(root, item.file))) !== item.sha256) throw new Error('Original license catalog changed');
    }
    for (const item of catalog.packages) if (lock.packages[`node_modules/${item.name}`]?.version !== item.version) throw new Error(`Direct dependency catalog is stale: ${item.name}`);
  }
  const upstreamPath = join(root, 'public/licenses/upstream-evidence.json');
  if (existsSync(upstreamPath)) {
    for (const item of readJson(upstreamPath).packages) {
      if (!Object.entries(lock.packages).some(([location, value]) => location.split('node_modules/').at(-1) === item.name && value.version === item.version)) throw new Error(`Upstream evidence is stale: ${item.name}`);
      if (item.status !== 'upstream-text-collected') continue;
      if (!/^[0-9a-f]{40}$/.test(item.commit) || !item.sourceUrl.startsWith(`https://raw.githubusercontent.com/${item.repository}/${item.commit}/`) || item.file !== `public/licenses/dependency-texts/${item.sha256}.txt` || !/^[0-9a-f]{64}$/.test(item.sha256) || digest(readFileSync(join(root, item.file))) !== item.sha256) throw new Error('Upstream evidence changed');
    }
  }
  const fontsPath = join(root, 'public/licenses/font-binaries.json');
  if (existsSync(fontsPath)) {
    const fonts = readJson(fontsPath);
    for (const item of fonts.fonts) {
      if (!/^[0-9a-f]{64}$/.test(item.sha256) || item.file !== `public/fonts/${item.sha256}.woff2` || !item.sourceUrl.startsWith('https://fonts.gstatic.com/') || digest(readFileSync(join(root, item.file))) !== item.sha256) throw new Error('Pinned font differs from its recorded source');
    }
    if (fonts.cssFile !== 'src/app/fonts.css' || digest(readFileSync(join(root, fonts.cssFile))) !== fonts.cssSha256) throw new Error('Pinned font CSS changed');
    const css = readFileSync(join(root, fonts.cssFile), 'utf8');
    for (const url of css.matchAll(/url\(([^)]+)\)/g)) if (!fonts.fonts.some(item => '/' + item.file.slice('public/'.length) === url[1])) throw new Error('Unrecorded font in CSS');
  }
  const assetsPath = join(root, 'public/licenses/assets.json');
  if (existsSync(assetsPath)) {
    const assets = readJson(assetsPath);
    for (const item of [...assets.assets, ...assets.supplemental]) {
      if (!['src/app/icon.svg', 'public/licenses/project-MIT.txt', 'public/licenses/supplemental/GPL-3.0.txt', 'public/licenses/supplemental/LGPL-3.0.txt'].includes(item.file) || digest(readFileSync(join(root, item.file))) !== item.sha256) throw new Error('Recorded asset changed');
      if (item.file === 'public/licenses/project-MIT.txt' && digest(readFileSync(join(root, 'LICENSE'))) !== item.sha256) throw new Error('Project license copy is stale');
    }
    for (const item of assets.retired) if ((item.file.startsWith('public/') || item.file === 'src/app/favicon.ico') && !item.file.includes('..') && existsSync(join(root, item.file))) throw new Error(`Retired asset reintroduced: ${item.file}`);
  }
  return profiles.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = process.cwd();
    if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Usage: node scripts/license-inventory.mjs [--check]');
    if (process.argv.includes('--check')) console.log(`License inventory integrity checked: ${check(root)} profiles (not a permission/compliance verdict)`);
    else {
      const data = generate(root);
      const counts = Object.fromEntries(['not-installed', 'metadata-only', 'notices-collected'].map(value => [value, data.packages.filter(item => item.evidence === value).length]));
      console.log(JSON.stringify({ profile: data.profile, packages: data.packages.length, texts: Object.keys(data.texts).length, ...counts }));
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
