import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { parseDocument } from "yaml";

const repositoryRoot = resolve(process.cwd());
const execFileAsync = promisify(execFile);
const authoredExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".py",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const authoredNames = new Set([
  ".editorconfig",
  ".gitattributes",
  ".gitignore",
  ".node-version",
  "CODEOWNERS",
]);
const requiredCollaborationFiles = [
  ".editorconfig",
  ".github/CODEOWNERS",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/dependabot.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/ISSUE_TEMPLATE/bug.yml",
  ".github/ISSUE_TEMPLATE/docs.yml",
  ".github/ISSUE_TEMPLATE/evaluation.yml",
  ".github/ISSUE_TEMPLATE/feature.yml",
  ".github/ISSUE_TEMPLATE/question.yml",
  ".github/ISSUE_TEMPLATE/representation.yml",
  "CHANGELOG.md",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "GOVERNANCE.md",
  "SECURITY.md",
  "SUPPORT.md",
  "docs/README.md",
  "docs/decisions/0000-template.md",
  "docs/decisions/README.md",
];

interface Failure {
  readonly file: string;
  readonly message: string;
}

async function repositoryFiles(): Promise<string[]> {
  const { stdout } = await execFileAsync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  );
  return stdout
    .split("\0")
    .filter((path) => path.length > 0)
    .map((path) => join(repositoryRoot, path));
}

function repoPath(path: string): string {
  return relative(repositoryRoot, path).replaceAll("\\", "/");
}

function markdownTarget(rawTarget: string): string | undefined {
  const trimmed = rawTarget.trim();
  if (trimmed.startsWith("<")) {
    const close = trimmed.indexOf(">");
    return close === -1 ? trimmed : trimmed.slice(1, close);
  }
  const titleStart = trimmed.search(/\s+["']/u);
  return titleStart === -1 ? trimmed : trimmed.slice(0, titleStart);
}

async function checkMarkdownLinks(file: string, source: string): Promise<Failure[]> {
  const failures: Failure[] = [];
  const links = source.matchAll(/!?\[[^\]]*\]\(([^)\n]+)\)/gu);
  for (const link of links) {
    const rawTarget = link[1];
    if (rawTarget === undefined) {
      continue;
    }
    const target = markdownTarget(rawTarget);
    if (
      target === undefined ||
      target.length === 0 ||
      target.startsWith("#") ||
      /^(?:data:|https?:|mailto:)/iu.test(target)
    ) {
      continue;
    }
    const pathOnly = target.split("#", 1)[0]?.split("?", 1)[0];
    if (pathOnly === undefined || pathOnly.length === 0) {
      continue;
    }
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathOnly);
    } catch {
      failures.push({ file: repoPath(file), message: `invalid link escape: ${target}` });
      continue;
    }
    const resolved = resolve(dirname(file), decoded);
    const relativeTarget = relative(repositoryRoot, resolved);
    if (
      relativeTarget === ".." ||
      relativeTarget.startsWith(`..${sep}`) ||
      isAbsolute(relativeTarget)
    ) {
      failures.push({ file: repoPath(file), message: `link leaves repository: ${target}` });
      continue;
    }
    try {
      await stat(resolved);
    } catch {
      failures.push({ file: repoPath(file), message: `missing link target: ${target}` });
    }
  }
  return failures;
}

function checkGithubYaml(file: string, source: string): Failure[] {
  const relativePath = repoPath(file);
  if (!relativePath.startsWith(".github/") || !/[.]ya?ml$/u.test(relativePath)) {
    return [];
  }
  const document = parseDocument(source, { prettyErrors: true, uniqueKeys: true });
  return document.errors.map((error) => ({
    file: relativePath,
    message: `invalid YAML: ${error.message.replaceAll("\n", " ")}`,
  }));
}

async function main(): Promise<void> {
  const failures: Failure[] = [];
  for (const required of requiredCollaborationFiles) {
    try {
      await stat(join(repositoryRoot, required));
    } catch {
      failures.push({ file: required, message: "required collaboration file is missing" });
    }
  }

  const files = await repositoryFiles();
  let authoredFileCount = 0;
  let markdownFileCount = 0;
  let githubYamlCount = 0;
  for (const file of files) {
    if (repoPath(file) === "pnpm-lock.yaml") {
      continue;
    }
    if (!authoredExtensions.has(extname(file)) && !authoredNames.has(basename(file))) {
      continue;
    }
    authoredFileCount += 1;
    const source = await readFile(file, "utf8");
    const forbiddenIndex = source.search(/[\u2013\u2014]/u);
    if (forbiddenIndex !== -1) {
      failures.push({
        file: repoPath(file),
        message: `contains a forbidden en dash or em dash at character ${forbiddenIndex}`,
      });
    }
    if (extname(file) === ".md") {
      markdownFileCount += 1;
      failures.push(...(await checkMarkdownLinks(file, source)));
    }
    if (repoPath(file).startsWith(".github/") && /[.]ya?ml$/u.test(file)) {
      githubYamlCount += 1;
    }
    failures.push(...checkGithubYaml(file, source));
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`${failure.file}: ${failure.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `repository metadata verified: ${authoredFileCount} authored files, ${markdownFileCount} Markdown files, ${githubYamlCount} GitHub YAML files`,
  );
}

await main();
