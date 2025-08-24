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

export async function createTempWorkspace(): Promise<string> {
  const os = await import('node:os');
  const path = await import('node:path');
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'composer-'));
  return tmpDir;
}

export async function initRepo(dir: string) {
  await ex('git', ['init'], { cwd: dir });
  await ex('git', ['config', 'user.name', 'prompt2prod'], { cwd: dir });
  await ex('git', ['config', 'user.email', 'dev@local'], { cwd: dir });
}

export async function addRemote(dir: string, name: string, url: string) {
  await ex('git', ['remote', 'add', name, url], { cwd: dir });
}

export async function checkoutBranch(dir: string, branch: string, base: string) {
  // First ensure we have the base branch
  try {
    await ex('git', ['fetch', 'origin', base], { cwd: dir });
    await ex('git', ['checkout', '-B', base, `origin/${base}`], { cwd: dir });
  } catch {
    // If base doesn't exist remotely, create it
    await ex('git', ['checkout', '-B', base], { cwd: dir });
    await ex('git', ['commit', '--allow-empty', '-m', 'Initial commit'], { cwd: dir });
  }

  // Now create and checkout the new branch
  await ex('git', ['checkout', '-B', branch], { cwd: dir });
}

export async function commitAll(dir: string, message: string) {
  await stageAll(dir);
  return await commit(dir, message);
}

export async function pushBranch(dir: string, remote: string, branch: string) {
  await ex('git', ['push', remote, branch], { cwd: dir });
}

export async function remoteBranchExists(remoteUrl: string, branch: string): Promise<boolean> {
  try {
    const { stdout } = await ex('git', ['ls-remote', '--heads', remoteUrl, branch]);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export async function cleanupWorkspace(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (err) {
    // Log but don't throw - cleanup failures shouldn't break the main flow
    console.warn(`Failed to cleanup workspace ${dir}:`, err);
  }
}
