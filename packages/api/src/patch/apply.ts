import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export type PatchFile = { path: string; content: string };
export type Patch = { files: PatchFile[] };

export type ApplyOptions = {
  rootDir: string; // absolute path to workspace dir
  normalizeEol?: 'lf' | 'crlf' | 'none';
  overwrite?: boolean; // default true
};

export type ApplyResult = {
  wrote: string[]; // absolute paths written (sorted)
  skipped: string[]; // files skipped due to overwrite=false
};

function assertAbsolute(p: string) {
  if (!path.isAbsolute(p)) throw new Error(`Expected absolute path, got ${p}`);
}

function sanitizeRelative(rel: string): string {
  // normalize to POSIX-ish forward slashes for validation
  const norm = rel.replace(/\\/g, '/');
  if (!norm || norm.startsWith('/') || norm.includes('..')) {
    throw new Error(`Unsafe path: ${rel}`);
  }
  return norm;
}

function applyEol(content: string, mode: ApplyOptions['normalizeEol']): string {
  if (mode === 'none' || !mode) return content;
  const lf = content.replace(/\r\n/g, '\n');
  return mode === 'lf' ? lf : lf.replace(/\n/g, '\r\n');
}

export async function applyPatch(patch: Patch, opts: ApplyOptions): Promise<ApplyResult> {
  assertAbsolute(opts.rootDir);
  const overwrite = opts.overwrite ?? true;
  const wrote: string[] = [];
  const skipped: string[] = [];

  // deterministic write order
  const files = [...patch.files].sort((a, b) => a.path.localeCompare(b.path));

  for (const f of files) {
    const safeRel = sanitizeRelative(f.path);
    const abs = path.join(opts.rootDir, safeRel);

    // Ensure the target is inside rootDir
    const inside = path.relative(opts.rootDir, abs);
    if (inside.startsWith('..') || path.isAbsolute(inside)) {
      throw new Error(`Target escapes rootDir: ${f.path}`);
    }

    // Create parent dirs
    await fs.mkdir(path.dirname(abs), { recursive: true });

    // Overwrite logic
    try {
      if (!overwrite) {
        await fs.access(abs);
        skipped.push(abs);
        continue;
      }
    } catch {
      // file does not exist -> ok to write
    }

    const content = applyEol(f.content, opts.normalizeEol ?? 'lf');
    await fs.writeFile(abs, content, { encoding: 'utf8', mode: 0o644 });
    wrote.push(abs);
  }

  wrote.sort();
  skipped.sort();
  return { wrote, skipped };
}
