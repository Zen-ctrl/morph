import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const temporary = resolve(root, "tests", `.tmp-cli-${process.pid}`);
const artifact = resolve(temporary, "customers.morph.json");
const restored = resolve(temporary, "customers.restored.json");
const context = resolve(temporary, "customers.context.txt");
const tsxCli = resolve(root, "node_modules", "tsx", "dist", "cli.mjs");

function run(...args: string[]) {
  return spawnSync(process.execPath, [tsxCli, "packages/cli/src/index.ts", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, MORPH_ALLOW_NETWORK: "false" },
  });
}

describe("CLI end to end", () => {
  beforeAll(async () => {
    await mkdir(temporary, { recursive: true });
  });

  afterAll(async () => {
    const expectedPrefix = resolve(root, "tests", ".tmp-cli-");
    if (temporary.startsWith(expectedPrefix)) await rm(temporary, { recursive: true, force: true });
  });

  it("reports a real local tokenizer in doctor", () => {
    const result = run("doctor");
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as {
      ok: boolean;
      tokenizer: { id: string; modelBinding: string };
    };
    expect(report).toMatchObject({
      ok: true,
      tokenizer: { id: "o200k_base", modelBinding: "none" },
    });
  });

  it("compiles, renders, decodes, verifies, and refuses overwrite", async () => {
    const artifactRelative = relative(root, artifact);
    const restoredRelative = relative(root, restored);
    const contextRelative = relative(root, context);
    const compiled = run(
      "compile",
      "--input",
      "fixtures/examples/customers.json",
      "--task-file",
      "fixtures/examples/lookup.task.txt",
      "--target",
      "local-o200k-base",
      "--policy",
      "compatibility",
      "--output",
      artifactRelative,
    );
    expect(compiled.status, compiled.stderr).toBe(0);
    expect(JSON.parse(compiled.stdout)).toMatchObject({
      ok: true,
      selectedEncoding: "json-compact",
    });
    const overwrite = run(
      "compile",
      "--input",
      "fixtures/examples/customers.json",
      "--output",
      artifactRelative,
    );
    expect(overwrite.status).not.toBe(0);
    expect(overwrite.stderr).toContain("OUTPUT_EXISTS");
    expect(run("render", "--input", artifactRelative, "--output", contextRelative).status).toBe(0);
    expect(run("decode", "--input", artifactRelative, "--output", restoredRelative).status).toBe(0);
    const verified = run("verify", "--input", artifactRelative);
    expect(verified.status, verified.stderr).toBe(0);
    expect(JSON.parse(verified.stdout)).toMatchObject({ valid: true, semanticRoundTrip: "passed" });
    expect(parseJson(await readFile(restored, "utf8"))).toEqual(
      parseJson(await readFile(resolve(root, "fixtures/examples/customers.json"), "utf8")),
    );
    expect(await readFile(context, "utf8")).toContain("MORPH-PROMPT/1");
  }, 30_000);
});

function parseJson(text: string): unknown {
  return JSON.parse(text) as unknown;
}
