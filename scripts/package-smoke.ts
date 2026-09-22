import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const temporary = await mkdtemp(join(tmpdir(), "morph-package-smoke-"));
const packs = join(temporary, "packs");
const consumer = join(temporary, "consumer");
const configuredPnpmCli = process.env.npm_execpath;
if (configuredPnpmCli === undefined || configuredPnpmCli.length === 0) {
  throw new Error(
    "The package smoke test must be launched through pnpm so its exact CLI can be reused.",
  );
}
const pnpmCli: string = configuredPnpmCli;

function run(args: readonly string[], cwd = root): void {
  const result = spawnSync(process.execPath, [pnpmCli, ...args], {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    const failure = result.error === undefined ? "" : `\n${result.error.message}`;
    throw new Error(
      `Command failed: pnpm ${args.join(" ")}\n${result.stdout ?? ""}\n${result.stderr ?? ""}${failure}`,
    );
  }
}

try {
  await mkdir(packs, { recursive: true });
  await mkdir(consumer, { recursive: true });
  const packageFilters = [
    "@morph/core",
    "@morph/encoders",
    "@morph/tokenizer-adapters",
    "@morph/toon-adapter",
    "@morph/evaluation",
    "@morph/schema-registry",
    "@morph/jev-planner",
    "@morph/cli",
    "@morph/sdk",
  ];
  for (const filter of packageFilters) {
    run(["--filter", filter, "pack", "--pack-destination", packs]);
  }
  const resolvedTarballs = (await readdir(packs))
    .filter((name) => name.endsWith(".tgz"))
    .map((name) => join(packs, name));
  if (resolvedTarballs.length !== packageFilters.length) {
    throw new Error(
      `Expected ${packageFilters.length} package archives, found ${resolvedTarballs.length}.`,
    );
  }
  const tarballFor = (fragment: string): string => {
    const tarball = resolvedTarballs.find((candidate) => candidate.includes(fragment));
    if (tarball === undefined) throw new Error(`Missing packed archive containing '${fragment}'.`);
    return `file:${tarball.replaceAll("\\", "/")}`;
  };
  const dependencies = {
    "@morph/core": tarballFor("morph-core-"),
    "@morph/encoders": tarballFor("morph-encoders-"),
    "@morph/evaluation": tarballFor("morph-evaluation-"),
    "@morph/jev-planner": tarballFor("morph-jev-planner-"),
    "@morph/schema-registry": tarballFor("morph-schema-registry-"),
    "@morph/cli": tarballFor("morph-cli-"),
    "@morph/sdk": tarballFor("morph-sdk-"),
    "@morph/tokenizer-adapters": tarballFor("morph-tokenizer-adapters-"),
    "@morph/toon-adapter": tarballFor("morph-toon-adapter-"),
  };
  await writeFile(
    join(consumer, "package.json"),
    `${JSON.stringify(
      {
        name: "morph-clean-consumer",
        private: true,
        type: "module",
        dependencies,
        pnpm: { overrides: dependencies },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  run(["install", "--offline", "--frozen-lockfile=false"], consumer);
  run(["exec", "morph", "doctor"], consumer);
  run(["exec", "morph", "bench", "--suite", "conformance", "--offline"], consumer);
  await writeFile(
    join(consumer, "smoke.mjs"),
    [
      'import { createDefaultMorph, localO200kBaseProfile } from "@morph/sdk";',
      'import { DisabledJevAccessPatternClassifier } from "@morph/jev-planner";',
      'import { InMemorySchemaRegistry } from "@morph/schema-registry";',
      "const morph = createDefaultMorph();",
      'const result = await morph.compileJson(\'{"package":"ok"}\', {',
      '  task: { instruction: "Return package." },',
      "  target: localO200kBaseProfile,",
      '  constraints: { mode: "lossless", allowNetwork: false },',
      '  planner: { policy: "compatibility", objective: "prompt-tokens" },',
      "});",
      'if (!result.ok || morph.decodeJson(result.artifact) !== \'{"package":"ok"}\') process.exit(1);',
      "const registry = new InMemorySchemaRegistry();",
      'const bundle = await registry.register({ schema: { type: "object" }, interpretationGuideId: "smoke", interpretationGuideVersion: "1", interpretationGuideText: "Smoke guide." });',
      "if (!(await registry.has(bundle.bundleId))) process.exit(1);",
      'const classification = await new DisabledJevAccessPatternClassifier().classify({ taskInstruction: "Smoke.", allowNetwork: false, allowRemoteTaskDisclosure: false });',
      'if (classification.status !== "fallback") process.exit(1);',
      'process.stdout.write("packed SDK smoke passed\\n");',
      "",
    ].join("\n"),
    "utf8",
  );
  const nodeResult = spawnSync(process.execPath, [join(consumer, "smoke.mjs")], {
    cwd: consumer,
    encoding: "utf8",
  });
  if (nodeResult.status !== 0) {
    throw new Error(`Packed consumer failed.\n${nodeResult.stdout}\n${nodeResult.stderr}`);
  }
  process.stdout.write(nodeResult.stdout);
  const installed = await readFile(join(consumer, "package.json"), "utf8");
  if (!installed.includes("@morph/sdk"))
    throw new Error("The clean consumer did not install @morph/sdk.");
} finally {
  const expectedPrefix = join(tmpdir(), "morph-package-smoke-");
  if (temporary.startsWith(expectedPrefix)) await rm(temporary, { recursive: true, force: true });
}
