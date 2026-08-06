/**
 * Git utility functions
 * Supports cloning remote repositories to local temporary directories
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { exists } from './fs.js';
import { t } from '../i18n/index.js';

const execFileAsync = promisify(execFile);

/**
 * Git clone options
 */
export interface GitCloneOptions {
  /** Target directory path for cloning; if not specified, a temporary directory is created */
  targetDir?: string;
  /** Additional arguments for git clone */
  extraArgs?: string[];
  /** Whether to show verbose output */
  verbose?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Git clone result
 */
export interface GitCloneResult {
  /** Whether cloning was successful */
  success: boolean;
  /** Path to the local directory where the repo was cloned */
  targetDir?: string;
  /** Error message if cloning failed */
  error?: string;
  /** Whether it is a temporary directory */
  isTempDir: boolean;
}

/**
 * Clone a repository from a git URL
 * @param gitUrl Git repository URL (e.g., https://github.com/user/repo.git)
 * @param options Cloning options
 * @returns GitCloneResult
 */
export async function gitClone(
  gitUrl: string,
  options: GitCloneOptions = {}
): Promise<GitCloneResult> {
  const { targetDir, extraArgs = [], verbose = false, timeout = 120000 } = options;

  // Determine target directory
  let cloneTarget: string;
  let isTempDir: boolean;

  if (targetDir) {
    cloneTarget = targetDir;
    isTempDir = false;
  } else {
    // Create temporary directory
    const tempBase = tmpdir();
    const uniqueId = randomUUID().slice(0, 8);
    cloneTarget = join(tempBase, `tmp_proj_${uniqueId}`);
    isTempDir = true;
  }

  // Build git clone command. Use execFile (not exec) so arguments are never
  // interpreted by a shell: a repository URL containing shell metacharacters
  // must stay a plain argument instead of being executed.
  const args = ['clone', gitUrl, cloneTarget, ...extraArgs];

  try {
    // Check if git is available
    await execFileAsync('git', ['--version'], { timeout: 5000 });

    // Execute git clone
    const { stdout, stderr } = await execFileAsync('git', args, {
      timeout,
      encoding: 'utf-8',
    });

    if (verbose && stdout) {
      console.log(stdout);
    }
    if (verbose && stderr) {
      console.error(stderr);
    }

    // Verify clone result
    const cloned = await exists(cloneTarget);
    if (!cloned) {
      return {
        success: false,
        error: t('error_git_clone_failed', {
          url: gitUrl,
          reason: t('error_target_dir_not_created'),
        }),
        isTempDir,
      };
    }

    return {
      success: true,
      targetDir: cloneTarget,
      isTempDir,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      targetDir: isTempDir ? cloneTarget : undefined,
      error: t('error_git_clone_failed', { url: gitUrl, reason: errorMsg }),
      isTempDir,
    };
  }
}

/**
 * Remove temporary directory
 * @param dirPath Path to the directory to be removed
 * @param force Whether to force removal (ignore errors)
 * @returns Whether removal was successful
 */
export async function removeTempDir(dirPath: string, force = true): Promise<boolean> {
  try {
    const dirExists = await exists(dirPath);
    if (!dirExists) {
      return true;
    }

    await rm(dirPath, {
      recursive: true,
      force,
      maxRetries: 3,
      retryDelay: 200,
    });

    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(t('error_remove_temp_dir_failed', { path: dirPath, error: errorMsg }));
    return false;
  }
}

/**
 * Validate git URL format
 * @param gitUrl URL to validate
 * @returns Whether it is a valid git URL
 */
export function isValidGitUrl(gitUrl: string): boolean {
  // Reject whitespace, control characters and shell metacharacters so a URL
  // can never be interpreted as more than one argument (defense in depth
  // alongside execFile, which does not invoke a shell).
  if (/[\s;|&$`"'<>()\\]/.test(gitUrl)) {
    return false;
  }

  // HTTPS format
  if (/^https?:\/\/.+/.test(gitUrl)) {
    return true;
  }

  // SSH format
  if (/^git@[^:]+:.+/.test(gitUrl)) {
    return true;
  }

  // Local path (also allowed)
  if (/^[./~]/.test(gitUrl)) {
    return true;
  }

  return false;
}
