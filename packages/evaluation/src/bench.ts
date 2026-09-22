#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runMicrobenchmarks, runOfflineConformance, runOfflineTokenSuite } from "./index.js";

interface Manifest {
  readonly manifestVersion: string;
  readonly fixtureVersion: string;
  readonly seed: number;
  readonly fixtures: readonly string[];
}

const suite = process.argv[2];
const workspaceRoot = fileURLToPath(new URL("../../../", import.meta.url));
const manifestPath = resolve(workspaceRoot, "fixtures/benchmark-manifests/offline-v1.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
const benchmark = {
  benchmarkManifestVersion: manifest.manifestVersion,
  fixtureVersion: manifest.fixtureVersion,
  seed: manifest.seed,
};

if (suite === "conformance") {
  const result = await runOfflineConformance(manifest.fixtures, workspaceRoot, benchmark);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.failed === 0 ? 0 : 1;
} else if (suite === "tokens") {
  const result = await runOfflineTokenSuite(manifest.fixtures, workspaceRoot, benchmark);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else if (suite === "performance") {
  const first = manifest.fixtures[0];
  if (first === undefined) throw new Error("The benchmark manifest contains no fixtures.");
  const result = await runMicrobenchmarks(await readFile(resolve(workspaceRoot, first), "utf8"), {
    benchmark,
    fixtureId: first,
    baseDirectory: workspaceRoot,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  process.stderr.write("Usage: bench.ts conformance|tokens|performance\n");
  process.exitCode = 2;
}
