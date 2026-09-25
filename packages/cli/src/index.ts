#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  link,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type AccessPattern,
  createMorph,
  fromJsValue,
  irNodeToJsonCompatible,
  type MorphArtifact,
  MorphException,
  type MorphRequest,
  type PlannerPolicy,
  parseArtifactJson,
  parseJsonStrict,
  printJson,
  profileIR,
} from "@morph/core";
import { builtInEncoders } from "@morph/encoders";
import {
  renderOfflineReport,
  runMicrobenchmarks,
  runOfflineConformance,
  runOfflineTokenSuite,
} from "@morph/evaluation";
import {
  localO200kBaseProfile,
  localO200kBaseTokenizer,
  O200K_BASE_ASSET,
  verifyLocalO200kAsset,
} from "@morph/tokenizer-adapters";
import { toonEncoder } from "@morph/toon-adapter";
import { Command, InvalidArgumentError } from "commander";

const VERSION = "0.1.0";
const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_ARTIFACT_BYTES = 20 * 1024 * 1024;
const BUNDLED_BENCHMARK_ROOT = fileURLToPath(new URL("../benchmark-fixtures/", import.meta.url));
const compiler = createMorph({
  encoders: [...builtInEncoders, toonEncoder],
  tokenizers: [localO200kBaseTokenizer],
  targetProfiles: [localO200kBaseProfile],
  qualityProfiles: [],
});

interface CompileOptions {
  readonly input: string;
  readonly task?: string;
  readonly taskFile?: string;
  readonly schema?: string;
  readonly target: string;
  readonly policy: PlannerPolicy;
  readonly accessPattern: AccessPattern;
  readonly maxPromptTokens?: number;
  readonly reservedOutputTokens?: number;
  readonly encoding?: string;
  readonly allowExperimental?: boolean;
  readonly allowNetwork?: boolean;
  readonly output?: string;
  readonly report?: string;
  readonly force?: boolean;
}

function positiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new InvalidArgumentError("Expected a nonnegative safe integer.");
  }
  return parsed;
}

function decodeUtf8(content: Uint8Array, label: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(content);
  } catch {
    throw new MorphException({
      code: "INVALID_UTF8",
      message: `${label} must contain valid UTF-8 text.`,
    });
  }
}

async function readStdin(maxBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > maxBytes) {
      throw new MorphException({
        code: "MAX_INPUT_BYTES_EXCEEDED",
        message: "Standard input exceeds the configured byte limit.",
        details: { maxBytes, observedBytes: total },
      });
    }
    chunks.push(buffer);
  }
  return decodeUtf8(Buffer.concat(chunks, total), "Standard input");
}

async function readInput(path: string, maxBytes = MAX_INPUT_BYTES): Promise<string> {
  if (path === "-") return readStdin(maxBytes);
  const metadata = await stat(path);
  if (!metadata.isFile()) {
    throw new MorphException({
      code: "INVALID_INPUT",
      message: `'${path}' is not a regular file.`,
    });
  }
  if (metadata.size > maxBytes) {
    throw new MorphException({
      code: "MAX_INPUT_BYTES_EXCEEDED",
      message: `'${path}' exceeds the configured byte limit.`,
      details: { maxBytes, inputBytes: metadata.size },
    });
  }
  const content = await readFile(path);
  if (content.byteLength > maxBytes) {
    throw new MorphException({
      code: "MAX_INPUT_BYTES_EXCEEDED",
      message: `'${path}' grew beyond the configured byte limit while being read.`,
      details: { maxBytes, inputBytes: content.byteLength },
    });
  }
  return decodeUtf8(content, `'${path}'`);
}

function outputPath(path: string): string {
  const workspace = resolve(process.cwd());
  const resolved = resolve(path);
  const rel = relative(workspace, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new MorphException({
      code: "OUTPUT_OUTSIDE_WORKSPACE",
      message: "Output paths must remain inside the selected workspace.",
    });
  }
  return resolved;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function assertOutputAvailable(path: string, force = false): Promise<void> {
  const destination = outputPath(path);
  if (!force && (await exists(destination))) {
    throw new MorphException({
      code: "OUTPUT_EXISTS",
      message: `Refusing to overwrite '${path}' without --force.`,
    });
  }
}

function isWithin(parent: string, candidate: string): boolean {
  const rel = relative(parent, candidate);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

async function prepareSafeOutputParent(destination: string): Promise<void> {
  const workspaceReal = await realpath(resolve(process.cwd()));
  const desiredParent = dirname(destination);
  let existingAncestor = desiredParent;
  while (!(await exists(existingAncestor))) {
    const next = dirname(existingAncestor);
    if (next === existingAncestor) {
      throw new MorphException({
        code: "OUTPUT_OUTSIDE_WORKSPACE",
        message: "No existing output ancestor could be validated.",
      });
    }
    existingAncestor = next;
  }
  const ancestorReal = await realpath(existingAncestor);
  if (!isWithin(workspaceReal, ancestorReal)) {
    throw new MorphException({
      code: "OUTPUT_OUTSIDE_WORKSPACE",
      message: "The resolved output ancestor must remain inside the selected workspace.",
    });
  }
  await mkdir(desiredParent, { recursive: true });
  const parentReal = await realpath(desiredParent);
  if (!isWithin(workspaceReal, parentReal)) {
    throw new MorphException({
      code: "OUTPUT_OUTSIDE_WORKSPACE",
      message: "The resolved output parent must remain inside the selected workspace.",
    });
  }
}

async function atomicWrite(path: string, content: string, force = false): Promise<void> {
  const destination = outputPath(path);
  await assertOutputAvailable(path, force);
  await prepareSafeOutputParent(destination);
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  const backup = `${destination}.${process.pid}.${randomUUID()}.bak`;
  try {
    await writeFile(temporary, content, { encoding: "utf8", flag: "wx" });
    if (!force) {
      await link(temporary, destination);
      await rm(temporary, { force: true });
    } else if (!(await exists(destination))) {
      await rename(temporary, destination);
    } else if (process.platform !== "win32") {
      await rename(temporary, destination);
    } else {
      await rename(destination, backup);
      try {
        await rename(temporary, destination);
        await rm(backup, { force: true });
      } catch (error) {
        await rename(backup, destination).catch(() => undefined);
        throw error;
      }
    }
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

function parseSchema(text: string): unknown {
  const ir = parseJsonStrict(text);
  return JSON.parse(printJson(ir)) as unknown;
}

async function createRequest(options: CompileOptions): Promise<MorphRequest> {
  if (options.target !== localO200kBaseProfile.profileId) {
    throw new MorphException({
      code: "UNSUPPORTED_TARGET_PROFILE",
      message: `Only '${localO200kBaseProfile.profileId}' is bundled in the offline release.`,
    });
  }
  const [text, task, schemaText] = await Promise.all([
    readInput(options.input),
    options.taskFile === undefined
      ? Promise.resolve(options.task ?? "Review the complete dataset.")
      : readInput(options.taskFile),
    options.schema === undefined ? Promise.resolve(undefined) : readInput(options.schema),
  ]);
  const policy = options.allowExperimental ? "economy-experimental" : options.policy;
  return {
    data: { kind: "json-text", text },
    ...(schemaText === undefined ? {} : { schema: parseSchema(schemaText) }),
    task: { instruction: task, accessPattern: options.accessPattern },
    target: localO200kBaseProfile,
    constraints: {
      mode: "lossless",
      ...(options.maxPromptTokens === undefined
        ? {}
        : { maxPromptTokens: options.maxPromptTokens }),
      ...(options.reservedOutputTokens === undefined
        ? {}
        : { reservedOutputTokens: options.reservedOutputTokens }),
      allowNetwork: options.allowNetwork ?? false,
    },
    planner: {
      policy,
      objective: "prompt-tokens",
      ...(options.encoding === undefined ? {} : { forcedEncoding: options.encoding }),
    },
  };
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function loadArtifact(path: string): Promise<MorphArtifact> {
  return parseArtifactJson(await readInput(path, MAX_ARTIFACT_BYTES));
}

function samePath(left: string, right: string): boolean {
  const resolvedLeft = resolve(left);
  const resolvedRight = resolve(right);
  return process.platform === "win32"
    ? resolvedLeft.toLowerCase() === resolvedRight.toLowerCase()
    : resolvedLeft === resolvedRight;
}

function addCompileOptions(command: Command): Command {
  return command
    .requiredOption("-i, --input <path>", "JSON input path, or - for stdin")
    .option("--task <text>", "Task instruction")
    .option("--task-file <path>", "Read the task instruction from a file")
    .option("--schema <path>", "Optional bundled Draft 2020-12 schema")
    .option("--target <profile>", "Registered target profile", "local-o200k-base")
    .option(
      "--policy <policy>",
      "compatibility, economy-experimental, or validated",
      "compatibility",
    )
    .option("--access-pattern <pattern>", "Task access-pattern hint", "unknown")
    .option("--max-prompt-tokens <count>", "Maximum visible rendered-text tokens", positiveInteger)
    .option("--reserved-output-tokens <count>", "Reserved output tokens", positiveInteger)
    .option("--encoding <id>", "Force one encoding family without bypassing gates")
    .option("--allow-experimental", "Use economy-experimental policy")
    .option("--allow-network", "Permit an explicitly configured network adapter; none is bundled");
}

function mapExitCode(code: string): number {
  if (
    code.includes("BUDGET") ||
    code.includes("MAX_") ||
    code.includes("TIMEOUT") ||
    code === "CANCELLED"
  )
    return 5;
  if (
    code.includes("ENCODER") ||
    code.includes("TARGET") ||
    code.includes("TOKENIZER") ||
    code.includes("UNSUPPORTED")
  )
    return 3;
  if (
    code.includes("DIGEST") ||
    code.includes("DECODE") ||
    code.includes("ARTIFACT") ||
    code.includes("ROUNDTRIP")
  )
    return 4;
  if (code.includes("INTEGRATION") || code.includes("PROVIDER") || code.includes("JEV")) return 6;
  return 2;
}

const program = new Command();
program
  .name("morph")
  .description("Compile structured JSON into verified model-facing representations.")
  .version(VERSION)
  .showHelpAfterError();

addCompileOptions(
  program
    .command("inspect")
    .description("Inspect accepted input shape without exposing raw values"),
).action(async (options: CompileOptions) => {
  const request = await createRequest(options);
  const ir =
    request.data.kind === "json-text"
      ? parseJsonStrict(request.data.text)
      : fromJsValue(request.data.value);
  process.stdout.write(
    json({
      irVersion: ir.irVersion,
      inputKind: ir.inputKind,
      semanticDigest: ir.semanticDigest,
      profile: profileIR(ir),
      note: "An aggregation access pattern is a layout hint. MORPH does not execute an aggregation.",
    }),
  );
});

addCompileOptions(
  program.command("compare").description("Measure and explain all bounded candidates"),
)
  .option("--report <path>", "Write the comparison report atomically")
  .option("--force", "Allow replacing an existing report")
  .action(async (options: CompileOptions) => {
    const report = await compiler.compare(await createRequest(options));
    const output = json(report);
    if (options.report !== undefined) await atomicWrite(options.report, output, options.force);
    process.stdout.write(output);
    if (!report.completedSearch) process.exitCode = 5;
  });

addCompileOptions(
  program.command("compile").description("Select and write a verified MORPH artifact"),
)
  .requiredOption("-o, --output <path>", "Artifact output path")
  .option("--report <path>", "Optional explain-report output path")
  .option("--force", "Allow replacing existing outputs")
  .action(async (options: CompileOptions) => {
    const result = await compiler.compile(await createRequest(options));
    if (!result.ok) throw new MorphException(result.error);
    if (options.report !== undefined && samePath(options.report, options.output as string)) {
      throw new MorphException({
        code: "OUTPUT_PATH_CONFLICT",
        message: "Artifact and report outputs must use different paths.",
      });
    }
    await assertOutputAvailable(options.output as string, options.force);
    if (options.report !== undefined) await assertOutputAvailable(options.report, options.force);
    if (options.report !== undefined)
      await atomicWrite(options.report, json(result.report), options.force);
    await atomicWrite(options.output as string, json(result.artifact), options.force);
    process.stdout.write(
      json({
        ok: true,
        output: resolve(options.output as string),
        artifactId: result.artifact.artifactId,
        selectedEncoding: result.artifact.plan.encoding,
        selectedTokens: result.report.candidates.find((candidate) => candidate.selected)?.tokens,
        modelQuality: "unbound",
      }),
    );
  });

program
  .command("render")
  .description("Render the exact complete text measured by MORPH")
  .requiredOption("-i, --input <path>", "Artifact path, or - for stdin")
  .option("-o, --output <path>", "Text output path; defaults to stdout")
  .option("--force", "Allow replacing an existing output")
  .action(async (options: { input: string; output?: string; force?: boolean }) => {
    const rendered = compiler.renderModelContext(await loadArtifact(options.input)).rendered;
    if (options.output === undefined) process.stdout.write(rendered);
    else await atomicWrite(options.output, rendered, options.force);
  });

program
  .command("decode")
  .description("Restore canonical JSON with preserved numeric lexemes")
  .requiredOption("-i, --input <path>", "Artifact path, or - for stdin")
  .option("-o, --output <path>", "JSON output path; defaults to stdout")
  .option("--force", "Allow replacing an existing output")
  .action(async (options: { input: string; output?: string; force?: boolean }) => {
    const restored = `${compiler.decodeJson(await loadArtifact(options.input))}\n`;
    if (options.output === undefined) process.stdout.write(restored);
    else await atomicWrite(options.output, restored, options.force);
  });

program
  .command("verify")
  .description("Verify artifact checksums, dependencies, and self-contained round trip")
  .requiredOption("-i, --input <path>", "Artifact path, or - for stdin")
  .action(async (options: { input: string }) => {
    const report = compiler.verify(await loadArtifact(options.input));
    process.stdout.write(json(report));
    if (!report.valid) process.exitCode = 4;
  });

program
  .command("bench")
  .description("Run an offline synthetic conformance, token, or performance suite")
  .requiredOption("--suite <suite>", "conformance, tokens, or performance")
  .option("--offline", "Assert the suite uses no remote evaluator")
  .option("--report <path>", "Optional JSON result path")
  .option("--markdown <path>", "Optional human-readable report path")
  .option("--force", "Allow replacing existing outputs")
  .action(
    async (options: {
      suite: string;
      offline?: boolean;
      report?: string;
      markdown?: string;
      force?: boolean;
    }) => {
      if (
        options.suite !== "conformance" &&
        options.suite !== "tokens" &&
        options.suite !== "performance"
      ) {
        throw new MorphException({
          code: "INVALID_BENCH_SUITE",
          message: "Suite must be conformance, tokens, or performance.",
        });
      }
      const manifest = irNodeToJsonCompatible(
        parseJsonStrict(
          await readInput(resolve(BUNDLED_BENCHMARK_ROOT, "manifest.json"), MAX_INPUT_BYTES),
        ).root,
      ) as {
        manifestVersion?: unknown;
        fixtureVersion?: unknown;
        seed?: unknown;
        fixtures?: unknown;
      };
      if (
        typeof manifest.manifestVersion !== "string" ||
        typeof manifest.fixtureVersion !== "string" ||
        !Number.isSafeInteger(manifest.seed) ||
        !Array.isArray(manifest.fixtures) ||
        manifest.fixtures.some((item) => typeof item !== "string")
      ) {
        throw new MorphException({
          code: "INVALID_BENCH_MANIFEST",
          message: "The fixture manifest is invalid.",
        });
      }
      const benchmark = {
        benchmarkManifestVersion: manifest.manifestVersion,
        fixtureVersion: manifest.fixtureVersion,
        seed: manifest.seed as number,
      };
      const firstFixture = (manifest.fixtures as string[])[0];
      const result =
        options.suite === "conformance"
          ? await runOfflineConformance(
              manifest.fixtures as string[],
              BUNDLED_BENCHMARK_ROOT,
              benchmark,
            )
          : options.suite === "tokens"
            ? await runOfflineTokenSuite(
                manifest.fixtures as string[],
                BUNDLED_BENCHMARK_ROOT,
                benchmark,
              )
            : firstFixture === undefined
              ? (() => {
                  throw new MorphException({
                    code: "INVALID_BENCH_MANIFEST",
                    message: "No performance fixture is available.",
                  });
                })()
              : await runMicrobenchmarks(
                  await readInput(resolve(BUNDLED_BENCHMARK_ROOT, firstFixture)),
                  {
                    benchmark,
                    fixtureId: firstFixture,
                    baseDirectory: BUNDLED_BENCHMARK_ROOT,
                  },
                );
      const output = json(result);
      if (options.report !== undefined) await atomicWrite(options.report, output, options.force);
      if (options.markdown !== undefined)
        await atomicWrite(options.markdown, renderOfflineReport(result), options.force);
      process.stdout.write(output);
      if (result.manifestVersion === "morph-offline-conformance/1" && result.failed > 0)
        process.exitCode = 1;
    },
  );

program
  .command("doctor")
  .description("Inspect local runtime assets without credentials or billable calls")
  .action(() => {
    const [major = 0, minor = 0] = process.versions.node
      .split(".")
      .slice(0, 2)
      .map((part) => Number.parseInt(part, 10));
    const runtimeCompatible = (major === 22 && minor >= 12) || major === 23 || major === 24;
    const tokenizerSmoke = localO200kBaseTokenizer.countText("MORPH offline tokenizer check.");
    const assetVerification = verifyLocalO200kAsset();
    const report = {
      ok: runtimeCompatible && tokenizerSmoke > 0 && assetVerification.valid,
      runtime: { node: process.versions.node, required: ">=22.12.0 <25" },
      encoders: [...builtInEncoders, toonEncoder].map(
        (encoder) => `${encoder.id}@${encoder.formatVersion}`,
      ),
      tokenizer: {
        id: localO200kBaseTokenizer.id,
        revision: localO200kBaseTokenizer.revision,
        smokeTokens: tokenizerSmoke,
        certainty: "exact-for-tokenizer",
        modelBinding: "none",
        asset: {
          expectedExpandedDigest: O200K_BASE_ASSET.digest,
          observedExpandedDigest: assetVerification.expandedAssetDigest,
          expectedBundledDigest: O200K_BASE_ASSET.bundledRanksDigest,
          observedBundledDigest: assetVerification.bundledRanksDigest,
          valid: assetVerification.valid,
        },
      },
      networkDefault: "disabled",
      jev: { package: "optional", liveContractTest: "not-run", requiredForCore: false },
      modelQuality: "not-run",
    };
    process.stdout.write(json(report));
    if (!report.ok) process.exitCode = 3;
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const morphError =
    error instanceof MorphException
      ? error.error
      : {
          code: "CLI_FAILURE",
          message: error instanceof Error ? error.message : "Unknown CLI failure.",
        };
  process.stderr.write(`${JSON.stringify({ ok: false, error: morphError })}\n`);
  process.exitCode = mapExitCode(morphError.code);
});
