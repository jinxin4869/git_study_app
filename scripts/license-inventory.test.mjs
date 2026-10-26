import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate, check } from './license-inventory.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'git-study-licenses-'));
  mkdirSync(join(root, 'node_modules/alpha/dist/compiled/vendor'), { recursive: true });
  writeFileSync(join(root, 'node_modules/alpha/package.json'), JSON.stringify({ name: 'alpha', version: '1.0.0' }));
  writeFileSync(join(root, 'node_modules/alpha/LICENSE'), 'MIT\nCopyright Example\n');
  writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { alpha: '1.0.0' } }));
  writeFileSync(join(root, 'node_modules/alpha/dist/compiled/vendor/NOTICE'), 'Vendor attribution\n');
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ packages: { '': {}, 'node_modules/alpha': { version: '1.0.0', license: 'MIT' }, 'node_modules/optional-platform': { version: '2.0.0', license: 'MPL-2.0', optional: true } } }));
  return root;
}
test('records all locked packages, nested notices and uninstalled platform scope', () => {
  const root = fixture();
  try {
    const data = generate(root, 'test-profile');
    assert.equal(data.packages.length, 2);
    assert.equal(data.packages[0].notices.length, 2);
    assert.equal(data.packages[1].evidence, 'not-installed');
    assert.equal(check(root), 1);
    const text = data.texts[data.packages[0].notices[0].sha256];
    assert.match(readFileSync(join(root, text.file), 'utf8'), /Copyright|attribution/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('detects changed license text and stale lockfile', () => {
  const root = fixture();
  try {
    const data = generate(root, 'test-profile');
    writeFileSync(join(root, Object.values(data.texts)[0].file), 'tampered');
    assert.throws(() => check(root), /Notice changed/);
    generate(root, 'test-profile');
    writeFileSync(join(root, 'package-lock.json'), '{}');
    assert.throws(() => check(root), /regenerated/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('does not follow license symlinks and rejects stale installed versions and unsafe profiles', () => {
  const root = fixture();
  try {
    const external = join(root, 'private.txt'); writeFileSync(external, 'outside package');
    symlinkSync(external, join(root, 'node_modules/alpha/COPYING'));
    assert.equal(generate(root, 'test-profile').packages[0].notices.length, 2);
    assert.throws(() => generate(root, '../escape'), /Invalid profile/);
    writeFileSync(join(root, 'node_modules/alpha/package.json'), JSON.stringify({ version: '9.0.0' }));
    assert.throws(() => generate(root, 'test-profile'), /differs from lockfile/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('does not export files from linked packages or lockfile path traversal', () => {
  const root = fixture();
  try {
    rmSync(join(root, 'node_modules/alpha'), { recursive: true });
    mkdirSync(join(root, 'external')); writeFileSync(join(root, 'external/package.json'), '{"version":"1.0.0"}');
    symlinkSync(join(root, 'external'), join(root, 'node_modules/alpha'));
    assert.throws(() => generate(root, 'test-profile'), /outside node_modules/);
    writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ packages: { '../outside': { version: '1' } } }));
    assert.throws(() => generate(root, 'test-profile'), /Invalid locked package path/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('checks font hashes and original license catalog integrity', () => {
  const root = fixture();
  try {
    generate(root, 'test-profile');
    mkdirSync(join(root, 'public/fonts'), { recursive: true });
    writeFileSync(join(root, 'public/licenses/font-binaries.json'), JSON.stringify({ fonts: [{ file: 'public/fonts/invalid.woff2', sha256: 'invalid', sourceUrl: 'https://fonts.gstatic.com/font.woff2' }] }));
    assert.throws(() => check(root), /Pinned font/);
    rmSync(join(root, 'public/licenses/font-binaries.json'));
    writeFileSync(join(root, 'public/licenses/sources.json'), JSON.stringify({ packages: [{ name: 'alpha', version: '1.0.0', file: '../escape', sha256: 'invalid' }], fonts: { licenses: [] } }));
    assert.throws(() => check(root), /catalog changed/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('distinguishes publisher README statements from bundled license text', () => {
  const root = fixture();
  try {
    rmSync(join(root, 'node_modules/alpha/LICENSE'));
    rmSync(join(root, 'node_modules/alpha/dist'), { recursive: true });
    writeFileSync(join(root, 'node_modules/alpha/README.md'), '# Alpha\nUsage\n\n## License\nMIT, author Example\n');
    const data = generate(root, 'test-profile');
    assert.equal(data.packages[0].evidence, 'metadata-only');
    assert.equal(data.packages[0].notices.length, 0);
    assert.equal(data.packages[0].contexts[0].fromLine, 4);
    assert.equal(check(root), 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
