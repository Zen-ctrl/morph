import { execFileSync } from "node:child_process";
import { cpus } from "node:os";
import { canonicalJsonText, sha256Text } from "@morph/core";

export interface BenchmarkIdentity {
  readonly benchmarkManifestVersion: string;
  readonly fixtureVersion: string;
  readonly seed?: number;
}

export interface GitState {
  readonly commit: string | null;
  readonly dirty: boolean | null;
}

export interface EvaluationEnvironment {
  readonly node: string;
  readonly platform: string;
  readonly architecture: string;
  readonly cpuModel: string | null;
  readonly logicalCpuCount: number;
}

export interface EvaluationProvenance {
  readonly benchmark: BenchmarkIdentity;
  readonly git: GitState;
  readonly environment: EvaluationEnvironment;
  readonly fixtureSetDigest: string;
}

export interface FixtureIdentityInput {
  readonly path: string;
  readonly textDigest: string;
}

export const DEFAULT_BENCHMARK_IDENTITY: BenchmarkIdentity = {
  benchmarkManifestVersion: "morph-benchmark-manifest/1",
  fixtureVersion: "synthetic-v2",
  seed: 20_260_921,
};

function runGit(baseDirectory: string, args: readonly string[]): string | null {
  try {
    return execFileSync("git", ["-C", baseDirectory, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5_000,
    }).trim();
  } catch {
    return null;
  }
}

export function inspectGitState(baseDirectory = process.cwd()): GitState {
  const commit = runGit(baseDirectory, ["rev-parse", "HEAD"]);
  const status = runGit(baseDirectory, ["status", "--porcelain=v1", "--untracked-files=normal"]);
  return {
    commit: commit === null || commit.length === 0 ? null : commit,
    dirty: status === null ? null : status.length > 0,
  };
}

export function evaluationEnvironment(): EvaluationEnvironment {
  const processors = cpus();
  return {
    node: process.versions.node,
    platform: process.platform,
    architecture: process.arch,
    cpuModel: processors[0]?.model ?? null,
    logicalCpuCount: processors.length,
  };
}

export function collectEvaluationProvenance(
  fixtureInputs: readonly FixtureIdentityInput[],
  benchmark: BenchmarkIdentity = DEFAULT_BENCHMARK_IDENTITY,
  baseDirectory = process.cwd(),
): EvaluationProvenance {
  const fixtureSetDigest = sha256Text(
    canonicalJsonText(
      [...fixtureInputs].sort((left, right) =>
        left.path === right.path ? 0 : left.path < right.path ? -1 : 1,
      ),
    ),
  );
  return {
    benchmark,
    git: inspectGitState(baseDirectory),
    environment: evaluationEnvironment(),
    fixtureSetDigest,
  };
}
