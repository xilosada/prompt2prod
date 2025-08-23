import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { applyPatch, planPatch } from '../src/patch/apply.js';

let tmp: string;
const p = (...s: string[]) => path.join(tmp, ...s);

describe('applyPatch (complete)', () => {
  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'p2p-apply-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('writes files deterministically and normalizes EOL (global)', async () => {
    const res = await applyPatch(
      {
        files: [
          { path: 'b/one.txt', content: 'line1\r\nline2' },
          { path: 'a/nested/two.txt', content: 'x\ny' },
        ],
      },
      { rootDir: tmp, normalizeEol: 'lf' },
    );
    expect(res.wrote.map((x) => path.relative(tmp, x))).toEqual(['a/nested/two.txt', 'b/one.txt']);
    expect(readFileSync(p('a/nested/two.txt'), 'utf8')).toBe('x\ny');
    expect(readFileSync(p('b/one.txt'), 'utf8')).toBe('line1\nline2');
  });

  it('respects overwrite=false for writes', async () => {
    writeFileSync(p('x.txt'), 'v1', 'utf8');
    const res = await applyPatch(
      { files: [{ path: 'x.txt', content: 'v2' }] },
      { rootDir: tmp, overwrite: false },
    );
    expect(res.skipped.map((x) => path.relative(tmp, x))).toEqual(['x.txt']);
    expect(readFileSync(p('x.txt'), 'utf8')).toBe('v1');
  });

  it('per-file EOL override', async () => {
    await applyPatch(
      {
        ops: [
          { kind: 'write', path: 'a.txt', content: 'a\r\nb', eol: 'lf' },
          { kind: 'write', path: 'b.txt', content: 'a\nb', eol: 'crlf' },
          { kind: 'write', path: 'c.bin', content: 'a\r\nb', eol: 'none' },
        ],
      },
      { rootDir: tmp, normalizeEol: 'lf' },
    );
    expect(readFileSync(p('a.txt'), 'utf8')).toBe('a\nb');
    expect(readFileSync(p('b.txt'), 'utf8')).toBe('a\r\nb');
    expect(readFileSync(p('c.bin'), 'utf8')).toBe('a\r\nb'); // untouched
  });

  it('delete and rename operations with ordering', async () => {
    // seed
    writeFileSync(p('keep.txt'), 'x', 'utf8');
    // Create directories first
    const { mkdirSync } = await import('node:fs');
    mkdirSync(p('old/dir'), { recursive: true });
    mkdirSync(p('move'), { recursive: true });
    writeFileSync(p('old/dir/file.txt'), 'y', 'utf8');
    writeFileSync(p('move/me.txt'), 'm', 'utf8');

    const res = await applyPatch(
      {
        ops: [
          { kind: 'delete', path: 'old/dir/file.txt' },
          { kind: 'rename', from: 'move/me.txt', to: 'moved/you.txt' },
          { kind: 'write', path: 'new/file.md', content: '# hi' },
        ],
      },
      { rootDir: tmp },
    );
    expect(res.deleted.map((x) => path.relative(tmp, x))).toEqual(['old/dir/file.txt']);
    expect(
      res.renamed.map((r) => ({ from: path.relative(tmp, r.from), to: path.relative(tmp, r.to) })),
    ).toEqual([{ from: 'move/me.txt', to: 'moved/you.txt' }]);
    expect(existsSync(p('new/file.md'))).toBe(true);
  });

  it('dryRun plans without touching filesystem', async () => {
    const res = await applyPatch(
      {
        ops: [
          { kind: 'write', path: 'a.txt', content: 'x' },
          { kind: 'delete', path: 'does-not-exist.txt' },
          { kind: 'rename', from: 'from.txt', to: 'to.txt' },
        ],
      },
      { rootDir: tmp, dryRun: true },
    );
    expect(res.plan.writes[0].rel).toBe('a.txt');
    expect(existsSync(p('a.txt'))).toBe(false);
    expect(res.deleted).toEqual([]); // simulated
    expect(res.renamed).toEqual([]);
  });

  it('atomic writes replace existing files safely', async () => {
    writeFileSync(p('atom.txt'), 'old', 'utf8');
    const res = await applyPatch(
      { files: [{ path: 'atom.txt', content: 'new' }] },
      { rootDir: tmp, atomic: true, overwrite: true },
    );
    expect(readFileSync(p('atom.txt'), 'utf8')).toBe('new');
    expect(res.wrote.map((x) => path.relative(tmp, x))).toEqual(['atom.txt']);
  });

  it('prevents traversal and root escapes on all paths (write/delete/rename)', async () => {
    await expect(
      applyPatch({ files: [{ path: '../evil.txt', content: 'x' }] }, { rootDir: tmp }),
    ).rejects.toThrow(/Unsafe path/);
    await expect(
      applyPatch({ ops: [{ kind: 'delete', path: '../../nope' }] }, { rootDir: tmp }),
    ).rejects.toThrow(/Unsafe path/);
    await expect(
      applyPatch({ ops: [{ kind: 'rename', from: 'x', to: '../y' }] }, { rootDir: tmp }),
    ).rejects.toThrow(/Unsafe path/);
  });

  it('allows names that contain ".." inside a segment (e.g., "foo..bar")', async () => {
    await applyPatch({ files: [{ path: 'dir/foo..bar.txt', content: 'ok' }] }, { rootDir: tmp });
    expect(readFileSync(p('dir/foo..bar.txt'), 'utf8')).toBe('ok');
  });

  it('rejects "." segments and empty segments', async () => {
    await expect(
      applyPatch({ files: [{ path: 'a/./b.txt', content: 'x' }] }, { rootDir: tmp }),
    ).rejects.toThrow(/Unsafe path/);
    await expect(
      applyPatch({ files: [{ path: 'a//b.txt', content: 'x' }] }, { rootDir: tmp }),
    ).rejects.toThrow(/Unsafe path/);
  });

  it('rename respects overwrite=false (skips when destination exists)', async () => {
    // seed
    writeFileSync(p('from.txt'), 'A', 'utf8');
    writeFileSync(p('to.txt'), 'B', 'utf8');
    const res = await applyPatch(
      { ops: [{ kind: 'rename', from: 'from.txt', to: 'to.txt' }] },
      { rootDir: tmp, overwrite: false },
    );
    // destination kept; source unchanged
    expect(readFileSync(p('to.txt'), 'utf8')).toBe('B');
    expect(readFileSync(p('from.txt'), 'utf8')).toBe('A');
    expect(res.renamed).toEqual([]);
  });

  it('backward compatibility with files API', async () => {
    const res = await applyPatch(
      { files: [{ path: 'test.txt', content: 'hello' }] },
      { rootDir: tmp },
    );
    expect(res.wrote.map((x) => path.relative(tmp, x))).toEqual(['test.txt']);
    expect(readFileSync(p('test.txt'), 'utf8')).toBe('hello');
  });

  it('planPatch returns deterministic plan', async () => {
    const plan = await planPatch(
      {
        ops: [
          { kind: 'write', path: 'z.txt', content: 'z' },
          { kind: 'write', path: 'a.txt', content: 'a' },
          { kind: 'delete', path: 'deep/nested/file.txt' },
          { kind: 'delete', path: 'shallow.txt' },
          { kind: 'rename', from: 'deep/old.txt', to: 'new.txt' },
          { kind: 'rename', from: 'shallow/old.txt', to: 'shallow/new.txt' },
        ],
      },
      { rootDir: tmp },
    );

    // Deletes should be deepest first
    expect(plan.deletes.map((d) => d.rel)).toEqual(['deep/nested/file.txt', 'shallow.txt']);

    // Renames should be deepest 'from' first
    expect(plan.renames.map((r) => r.fromRel)).toEqual(['deep/old.txt', 'shallow/old.txt']);

    // Writes should be lexicographic
    expect(plan.writes.map((w) => w.rel)).toEqual(['a.txt', 'z.txt']);
  });

  it('non-atomic writes work correctly', async () => {
    writeFileSync(p('nonatom.txt'), 'old', 'utf8');
    const res = await applyPatch(
      { files: [{ path: 'nonatom.txt', content: 'new' }] },
      { rootDir: tmp, atomic: false, overwrite: true },
    );
    expect(readFileSync(p('nonatom.txt'), 'utf8')).toBe('new');
    expect(res.wrote.map((x) => path.relative(tmp, x))).toEqual(['nonatom.txt']);
  });

  it('creates parent directories for all operations', async () => {
    // Create source file for rename
    const { mkdirSync } = await import('node:fs');
    mkdirSync(p('src'), { recursive: true });
    writeFileSync(p('src/old.txt'), 'old content', 'utf8');

    await applyPatch(
      {
        ops: [
          { kind: 'write', path: 'very/deep/nested/file.txt', content: 'content' },
          { kind: 'rename', from: 'src/old.txt', to: 'very/deep/nested/renamed.txt' },
        ],
      },
      { rootDir: tmp },
    );
    expect(existsSync(p('very/deep/nested/file.txt'))).toBe(true);
    expect(existsSync(p('very/deep/nested/renamed.txt'))).toBe(true);
  });
});
