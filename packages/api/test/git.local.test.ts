import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { applyPatch } from '../src/patch/apply.js';
import {
  initBareRemote,
  initWorkspace,
  ensureBranch,
  stageAll,
  commit,
  push,
} from '../src/git/local.js';

let tmp!: string;
let bare!: string;
let work!: string;
const td = (p: string) => path.join(tmp, p);

describe('local git plumbing', () => {
  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'p2p-git-'));
    bare = td('remote.git');
    work = td('work');
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('creates a branch and pushes a commit to a bare remote', async () => {
    const remoteUrl = await initBareRemote(bare);
    await initWorkspace(work, remoteUrl);

    await applyPatch(
      {
        files: [
          { path: 'README.generated.md', content: '# Hello\n' },
          { path: 'src/index.ts', content: 'export const x=1;\n' },
        ],
      },
      { rootDir: work, normalizeEol: 'lf' },
    );

    await ensureBranch(work, 'feat/patch');
    await stageAll(work);
    const sha = await commit(work, 'chore: seed workspace', { name: 'bot', email: 'bot@local' });
    await push(work, 'feat/patch');

    const ref = execFileSync(
      'git',
      ['for-each-ref', '--format=%(objectname)', 'refs/heads/feat/patch'],
      { cwd: bare },
    )
      .toString()
      .trim();
    expect(ref).toBe(sha);
  });
});
