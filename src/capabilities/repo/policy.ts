import { realpath } from "node:fs/promises";
import { join, normalize, relative, sep, isAbsolute } from "node:path";
import { DeniedError, ResourceError } from "../manifest.ts";
export { DeniedError, ResourceError };

export interface RepoPolicy {
  /** Workspace root the capability may read. Canonicalized at connect. */
  root: string;
  /** Max bytes returned by one readText call. Default 65536. */
  maxReadBytes?: number;
  /** Max matches returned by one searchText call. Default 100. */
  maxMatches?: number;
  /** Max files a searchText call will scan. Default 2000. */
  maxFilesScanned?: number;
  /** Files larger than this are skipped by searchText. Default 262144. */
  maxScanFileBytes?: number;
}

export interface ResolvedRepoPolicy {
  root: string;
  maxReadBytes: number;
  maxMatches: number;
  maxFilesScanned: number;
  maxScanFileBytes: number;
}

export async function resolvePolicy(policy: RepoPolicy): Promise<ResolvedRepoPolicy> {
  let root: string;
  try {
    root = await realpath(policy.root);
  } catch {
    throw new ResourceError(`repository root does not exist: ${policy.root}`);
  }
  return {
    root,
    maxReadBytes: policy.maxReadBytes ?? 65_536,
    maxMatches: policy.maxMatches ?? 100,
    maxFilesScanned: policy.maxFilesScanned ?? 2000,
    maxScanFileBytes: policy.maxScanFileBytes ?? 262_144,
  };
}

function insideRoot(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(root + sep);
}

function rejectGitDir(root: string, candidate: string): void {
  const rel = relative(root, candidate);
  if (rel === ".git" || rel.startsWith(`.git${sep}`))
    throw new DeniedError("the .git directory is not readable through this capability");
}

/**
 * Resolve a caller-supplied relative path to an absolute path inside the root.
 * Best-effort containment, enforced in trusted host code before I/O:
 * relative-only, normalized prefix check, .git exclusion, then realpath
 * (follows symlinks) with a second containment check. TOCTOU races and
 * privileged-reader escapes are outside this prototype's guarantees; see 012.
 */
export async function resolveInRoot(
  policy: ResolvedRepoPolicy,
  userPath: string,
): Promise<{ absolute: string; rel: string }> {
  if (!userPath || userPath.includes("\0"))
    throw new DeniedError("path must be a non-empty string without NUL");
  if (isAbsolute(userPath) || userPath.startsWith("~"))
    throw new DeniedError("only root-relative paths are accepted");
  const joined = normalize(join(policy.root, userPath));
  if (!insideRoot(policy.root, joined))
    throw new DeniedError(`path escapes the repository root: ${userPath}`);
  rejectGitDir(policy.root, joined);
  let absolute: string;
  try {
    absolute = await realpath(joined);
  } catch {
    throw new ResourceError(`no such file: ${userPath}`);
  }
  if (!insideRoot(policy.root, absolute))
    throw new DeniedError(`symlink escapes the repository root: ${userPath}`);
  rejectGitDir(policy.root, absolute);
  return { absolute, rel: relative(policy.root, absolute).split(sep).join("/") };
}
