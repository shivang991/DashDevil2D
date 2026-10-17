import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

interface CaptureOptions {
  outputRoot: string;
  repositoryRoot: string;
  fixtureVersion: number;
  fixtures: string[];
  configuration: string[];
}
const sha256 = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export function createCaptureRun(options: CaptureOptions) {
  fs.mkdirSync(options.outputRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(options.outputRoot, `run-${new Date().toISOString().replaceAll(':', '-')}-`));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: options.repositoryRoot, encoding: 'utf8' }).trim();
  const inputs = (files: string[]) => Object.fromEntries(files.map(file => [file, { sha256: sha256(fs.readFileSync(path.join(options.repositoryRoot, file))) }]));
  // Dirty assets can produce patches larger than a child-process stdout buffer.
  // Hash Git's patch incrementally, keeping bounded memory and no extra artifact.
  const patchPath = path.join(directory, 'working-tree.patch');
  execFileSync('git', ['diff', 'HEAD', '--binary', '--output', patchPath], { cwd: options.repositoryRoot });
  const patchHash = createHash('sha256');
  const descriptor = fs.openSync(patchPath, 'r');
  try {
    const chunk = Buffer.alloc(65536);
    let count: number;
    while ((count = fs.readSync(descriptor, chunk, 0, chunk.length, null)) > 0) patchHash.update(chunk.subarray(0, count));
  } finally { fs.closeSync(descriptor); fs.unlinkSync(patchPath); }
  const provenance = {
    baselineReference: 'a68f27efd1d79ec8eea7ef0b0a6d8567606189dd',
    testedRevision: git('rev-parse', 'HEAD'),
    worktreeStatus: git('status', '--porcelain'),
    trackedWorktreeDiffSha256: patchHash.digest('hex'),
    fixtureVersion: options.fixtureVersion,
    fixtures: inputs(options.fixtures),
    configuration: inputs(options.configuration),
    inputSnapshots: Object.fromEntries([...options.fixtures, ...options.configuration].map(file => [file, fs.readFileSync(path.join(options.repositoryRoot, file), 'utf8')])),
    capturedAt: new Date().toISOString(),
    environment: { node: process.version, platform: os.platform(), release: os.release(), architecture: os.arch(), cpu: os.cpus()[0]?.model, memoryBytes: os.totalmem() },
  };
  const artifactPath = (filename: string) => {
    const target = path.resolve(directory, filename);
    const relative = path.relative(directory, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Capture artifact must stay in its run directory');
    return target;
  };
  return { directory, provenance, artifactPath, finalize: (result: unknown) => writeCaptureManifest(directory, provenance, result) };
}

// Reporter calls this after Playwright closes screenshots, traces and videos.
export function writeCaptureManifest(directory: string, provenance: unknown, result: unknown) {
  const artifacts: Record<string, { bytes: number; sha256: string }> = {};
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const filename = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(filename);
      else if (filename !== path.join(directory, 'manifest.json')) {
        const bytes = fs.readFileSync(filename);
        artifacts[path.relative(directory, filename)] = { bytes: bytes.length, sha256: sha256(bytes) };
      }
    }
  };
  visit(directory);
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ version: 1, provenance, result, humanAudiovisualReview: 'pending', artifacts }, null, 2) + '\n', { flag: 'wx' });
}
