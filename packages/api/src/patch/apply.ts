import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';

export type EolMode = 'lf' | 'crlf' | 'none';

export type PatchFile = { path: string; content: string; eol?: EolMode }; // per-file override
export type WriteOp = { kind: 'write'; path: string; content: string; eol?: EolMode };
export type DeleteOp = { kind: 'delete'; path: string };
export type RenameOp = { kind: 'rename'; from: string; to: string };
export type PatchOp = WriteOp | DeleteOp | RenameOp;

/**
 * Back-compat: either `files` (writes only) or `ops` (full operation set).
 */
export type Patch = { files: PatchFile[]; ops?: never } | { files?: never; ops: PatchOp[] };

export type ApplyOptions = {
  rootDir: string; // absolute workspace root
  normalizeEol?: EolMode; // global default (default: 'lf')
  overwrite?: boolean; // default: true
  atomic?: boolean; // default: true
  dryRun?: boolean; // default: false
};

export type PlanWrite = {
  kind: 'write';
  abs: string;
  rel: string;
  eol: EolMode;
  willOverwrite: boolean;
};
export type PlanDelete = { kind: 'delete'; abs: string; rel: string; exists: boolean };
export type PlanRename = {
  kind: 'rename';
  fromAbs: string;
  fromRel: string;
  toAbs: string;
  toRel: string;
  willOverwrite: boolean;
};

export type ApplyPlan = {
  writes: PlanWrite[];
  deletes: PlanDelete[];
  renames: PlanRename[];
};

export type ApplyResult = {
  wrote: string[]; // absolute paths written
  skipped: string[]; // writes skipped due to overwrite=false
  deleted: string[]; // absolute paths deleted
  renamed: Array<{ from: string; to: string }>;
  plan: ApplyPlan; // full plan for auditing
};

function assertAbsolute(p: string) {
  if (!path.isAbsolute(p)) throw new Error(`Expected absolute path, got ${p}`);
}

function sanitizeRelative(rel: string): string {
  const norm = rel.replace(/\\/g, '/');
  if (!norm || norm.startsWith('/')) throw new Error(`Unsafe path: ${rel}`);
  // Reject empty segments, '.' or '..' segments
  const bad = norm.split('/').some((seg) => seg.length === 0 || seg === '.' || seg === '..');
  if (bad) throw new Error(`Unsafe path: ${rel}`);
  return norm;
}

function applyEol(content: string, mode: EolMode): string {
  if (mode === 'none') return content;
  const lf = content.replace(/\r\n/g, '\n');
  return mode === 'lf' ? lf : lf.replace(/\n/g, '\r\n');
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function tmpName(target: string) {
  return `${target}.tmp-${randomBytes(6).toString('hex')}`;
}

async function writeFileAtomic(abs: string, data: string, atomic: boolean, overwrite: boolean) {
  if (!atomic) {
    if (!overwrite && (await pathExists(abs))) return { wrote: false };
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, data, { encoding: 'utf8', mode: 0o644 });
    return { wrote: true };
  }

  await fs.mkdir(path.dirname(abs), { recursive: true });
  const tmp = tmpName(abs);
  const fh = await fs.open(tmp, 'w');
  try {
    await fh.writeFile(data, { encoding: 'utf8' });
    // attempt to flush file content; ignore if not supported
    try {
      await fh.sync();
    } catch {
      // fsync not supported on this platform
    }
  } finally {
    await fh.close();
  }
  if (overwrite && (await pathExists(abs))) {
    // On Windows, rename over existing can fail; remove first
    await fs.rm(abs, { force: true });
  }
  await fs.rename(tmp, abs);
  // Optionally fsync the directory for stronger guarantees (best-effort)
  try {
    const dirh = await fs.open(path.dirname(abs), 'r');
    try {
      await dirh.sync();
    } finally {
      await dirh.close();
    }
  } catch {
    // directory fsync not supported or failed
  }
  return { wrote: true };
}

/** Build an ordered, deterministic plan with safety checks. */
export async function planPatch(patch: Patch, opts: ApplyOptions): Promise<ApplyPlan> {
  assertAbsolute(opts.rootDir);
  const normalizeEol = opts.normalizeEol ?? 'lf';

  // Normalize inputs into ops[]
  const ops: PatchOp[] = patch.ops
    ? [...patch.ops]
    : (patch.files ?? []).map<WriteOp>((f) => ({
        kind: 'write',
        path: f.path,
        content: f.content,
        eol: f.eol,
      }));

  // Sanitize and resolve paths
  const writes: PlanWrite[] = [];
  const deletes: PlanDelete[] = [];
  const renames: PlanRename[] = [];

  const toAbs = (rel: string) => {
    const safeRel = sanitizeRelative(rel);
    const abs = path.join(opts.rootDir, safeRel);
    const inside = path.relative(opts.rootDir, abs);
    if (inside.startsWith('..') || path.isAbsolute(inside)) {
      throw new Error(`Target escapes rootDir: ${rel}`);
    }
    return { abs, rel: safeRel };
  };

  // Build preliminary items
  for (const op of ops) {
    if (op.kind === 'write') {
      const { abs, rel } = toAbs(op.path);
      const exists = await pathExists(abs);
      writes.push({
        kind: 'write',
        abs,
        rel,
        eol: op.eol ?? normalizeEol,
        willOverwrite: exists,
      });
    } else if (op.kind === 'delete') {
      const { abs, rel } = toAbs(op.path);
      deletes.push({ kind: 'delete', abs, rel, exists: await pathExists(abs) });
    } else if (op.kind === 'rename') {
      const { abs: fromAbs, rel: fromRel } = toAbs(op.from);
      const { abs: toAbsPath, rel: toRel } = toAbs(op.to);
      const willOverwrite = await pathExists(toAbsPath);
      renames.push({ kind: 'rename', fromAbs, fromRel, toAbs: toAbsPath, toRel, willOverwrite });
    }
  }

  // Deterministic ordering:
  // 1) deletes (deepest first), 2) renames (deepest 'from' first), 3) writes (lexicographic)
  deletes.sort(
    (a, b) => b.rel.split('/').length - a.rel.split('/').length || a.rel.localeCompare(b.rel),
  );
  renames.sort(
    (a, b) =>
      b.fromRel.split('/').length - a.fromRel.split('/').length ||
      a.fromRel.localeCompare(b.fromRel),
  );
  writes.sort((a, b) => a.rel.localeCompare(b.rel));

  return { writes, deletes, renames };
}

/** Execute plan (or dry-run). Back-compat: `applyPatch({ files })` still works. */
export async function applyPatch(patch: Patch, opts: ApplyOptions): Promise<ApplyResult> {
  const plan = await planPatch(patch, opts);
  const overwrite = opts.overwrite ?? true;
  const atomic = opts.atomic ?? true;
  const dryRun = opts.dryRun ?? false;

  const wrote: string[] = [];
  const skipped: string[] = [];
  const deleted: string[] = [];
  const renamed: Array<{ from: string; to: string }> = [];

  // Map rel -> write payload (content + per-file eol) for quick lookup
  const writePayloadByRel = (() => {
    const m = new Map<string, { content: string; eol?: EolMode }>();
    if ('ops' in patch && patch.ops) {
      for (const op of patch.ops) {
        if (op.kind === 'write') {
          const rel = sanitizeRelative(op.path);
          m.set(rel, { content: op.content, eol: op.eol });
        }
      }
    } else if ('files' in patch && patch.files) {
      for (const f of patch.files) {
        const rel = sanitizeRelative(f.path);
        m.set(rel, { content: f.content, eol: f.eol });
      }
    }
    return m;
  })();

  if (dryRun) {
    // Simulate results without touching the filesystem
    for (const d of plan.deletes) if (d.exists) deleted.push(d.abs);
    for (const r of plan.renames) {
      // Only include renames if source exists
      if (await pathExists(r.fromAbs)) {
        renamed.push({ from: r.fromAbs, to: r.toAbs });
      }
    }
    for (const w of plan.writes) {
      if (!overwrite && w.willOverwrite) skipped.push(w.abs);
      else wrote.push(w.abs);
    }
    return { wrote, skipped, deleted, renamed, plan };
  }

  // 1) Deletes
  for (const d of plan.deletes) {
    if (!d.exists) continue;
    await fs.rm(d.abs, { force: true, recursive: false });
    deleted.push(d.abs);
  }

  // 2) Renames (move files; ensure parent exists)
  for (const r of plan.renames) {
    await fs.mkdir(path.dirname(r.toAbs), { recursive: true });
    if (!overwrite && (await pathExists(r.toAbs))) {
      // skip if not allowed to overwrite
      continue;
    }
    if (await pathExists(r.toAbs)) {
      await fs.rm(r.toAbs, { force: true });
    }
    await fs.rename(r.fromAbs, r.toAbs);
    renamed.push({ from: r.fromAbs, to: r.toAbs });
  }

  // 3) Writes (atomic or normal)
  for (const w of plan.writes) {
    if (!overwrite && w.willOverwrite) {
      skipped.push(w.abs);
      continue;
    }

    const payload = writePayloadByRel.get(w.rel);
    if (!payload) throw new Error(`Internal: missing payload for ${w.rel}`);
    const normalized = applyEol(payload.content, w.eol);
    await writeFileAtomic(w.abs, normalized, atomic, overwrite);
    wrote.push(w.abs);
  }

  return { wrote, skipped, deleted, renamed, plan };
}
