import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { applyPatch } from '../src/patch/apply.js';

let tmp: string;

describe('applyPatch', () => {
  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'p2p-apply-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('writes files deterministically and normalizes EOL', async () => {
    const res = await applyPatch(
      {
        files: [
          { path: 'b/one.txt', content: 'line1\r\nline2' },
          { path: 'a/nested/two.txt', content: 'x\ny' },
        ],
      },
      { rootDir: tmp, normalizeEol: 'lf' },
    );
    expect(res.wrote.map((p) => path.relative(tmp, p))).toEqual(['a/nested/two.txt', 'b/one.txt']);
    const a = readFileSync(path.join(tmp, 'a/nested/two.txt'), 'utf8');
    const b = readFileSync(path.join(tmp, 'b/one.txt'), 'utf8');
    expect(a).toBe('x\ny');
    expect(b).toBe('line1\nline2');
  });

  it('respects overwrite=false', async () => {
    const file = path.join(tmp, 'x.txt');
    await applyPatch({ files: [{ path: 'x.txt', content: 'v1' }] }, { rootDir: tmp });
    const res = await applyPatch(
      { files: [{ path: 'x.txt', content: 'v2' }] },
      { rootDir: tmp, overwrite: false },
    );
    expect(res.skipped.map((p) => path.relative(tmp, p))).toEqual(['x.txt']);
    const cur = readFileSync(file, 'utf8');
    expect(cur).toBe('v1');
  });

  it('prevents path traversal', async () => {
    await expect(
      applyPatch({ files: [{ path: '../evil.txt', content: 'nope' }] }, { rootDir: tmp }),
    ).rejects.toThrow(/Unsafe path/);
  });

  it('prevents escaping rootDir after join', async () => {
    // Test with a path that would pass sanitizeRelative but escape rootDir
    // This tests the path.relative check as a defense-in-depth measure
    // Note: This test is more theoretical since sanitizeRelative catches most cases
    const tricky = 'dir/../escape.txt';
    await expect(
      applyPatch({ files: [{ path: tricky, content: 'nope' }] }, { rootDir: tmp }),
    ).rejects.toThrow(/Unsafe path/);
  });

  it('creates parent directories', async () => {
    await applyPatch({ files: [{ path: 'deep/dir/file.md', content: 'ok' }] }, { rootDir: tmp });
    expect(existsSync(path.join(tmp, 'deep/dir/file.md'))).toBe(true);
  });
});
