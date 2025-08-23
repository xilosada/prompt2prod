import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';

const ex = promisify(execFile);

export type GitAuthor = { name: string; email: string };

export async function initBareRemote(dir: string) {
  await fs.mkdir(dir, { recursive: true });
  await ex('git', ['init', '--bare'], { cwd: dir });
  return `file://${dir}`;
}

export async function initWorkspace(dir: string, remoteUrl: string) {
  await fs.mkdir(dir, { recursive: true });
  await ex('git', ['init'], { cwd: dir });
  await ex('git', ['remote', 'add', 'origin', remoteUrl], { cwd: dir });
  await ex('git', ['config', 'user.name', 'prompt2prod'], { cwd: dir });
  await ex('git', ['config', 'user.email', 'dev@local'], { cwd: dir });
}

export async function ensureBranch(dir: string, branch: string) {
  await ex('git', ['checkout', '-B', branch], { cwd: dir });
}

export async function stageAll(dir: string) {
  await ex('git', ['add', '-A'], { cwd: dir });
}

export async function commit(dir: string, message: string, author?: GitAuthor): Promise<string> {
  const env = { ...process.env };
  if (author) {
    env.GIT_AUTHOR_NAME = author.name;
    env.GIT_AUTHOR_EMAIL = author.email;
    env.GIT_COMMITTER_NAME = author.name;
    env.GIT_COMMITTER_EMAIL = author.email;
  }
  await ex('git', ['commit', '--no-gpg-sign', '--allow-empty', '-m', message], { cwd: dir, env });
  const { stdout } = await ex('git', ['rev-parse', 'HEAD'], { cwd: dir });
  return stdout.trim();
}

export async function push(dir: string, branch: string) {
  await ex('git', ['push', 'origin', `HEAD:refs/heads/${branch}`], { cwd: dir });
}
