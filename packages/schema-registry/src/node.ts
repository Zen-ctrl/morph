import { randomUUID } from "node:crypto";
import { link, lstat, mkdir, open, opendir, stat, unlink, writeFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import {
  assertSchemaBundleId,
  assertValidSchemaGuideBundle,
  createSchemaGuideBundle,
  normalizeSchemaRegistryLimits,
  parseSchemaGuideBundle,
  serializeSchemaGuideBundle,
} from "./registry.js";
import {
  type SchemaBundleId,
  type SchemaGuideBundle,
  type SchemaGuideBundleInput,
  type SchemaGuideRegistry,
  SchemaRegistryError,
  type SchemaRegistryLimits,
  type SchemaRegistryStats,
} from "./types.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const FILE_PATTERN = /^([0-9a-f]{64})\.bundle\.json$/;

function fail(code: string, message: string, details?: Readonly<Record<string, unknown>>): never {
  throw new SchemaRegistryError({
    code,
    message,
    ...(details === undefined ? {} : { details }),
  });
}

export interface FileSystemSchemaRegistryOptions extends Partial<SchemaRegistryLimits> {
  readonly directory: string;
  readonly createDirectory?: boolean;
}

interface DiskEntry {
  readonly id: SchemaBundleId;
  readonly path: string;
  readonly bytes: number;
}

export class FileSystemSchemaRegistry implements SchemaGuideRegistry {
  readonly #directory: string;
  readonly #limits: SchemaRegistryLimits;
  readonly #createDirectory: boolean;

  constructor(options: FileSystemSchemaRegistryOptions) {
    if (typeof options.directory !== "string" || options.directory.length === 0) {
      fail("REGISTRY_INVALID_DIRECTORY", "A local registry directory is required.");
    }
    this.#directory = resolvePath(options.directory);
    this.#createDirectory = options.createDirectory ?? true;
    this.#limits = normalizeSchemaRegistryLimits(options);
  }

  async #ensureDirectory(): Promise<void> {
    if (this.#createDirectory) {
      await mkdir(this.#directory, { recursive: true });
      return;
    }
    const information = await stat(this.#directory).catch(() => undefined);
    if (information === undefined || !information.isDirectory()) {
      fail(
        "REGISTRY_DIRECTORY_UNAVAILABLE",
        "The configured local registry directory is unavailable.",
      );
    }
  }

  #pathFor(bundleId: SchemaBundleId): string {
    const digest = bundleId.slice("sha256:".length);
    return resolvePath(this.#directory, `${digest}.bundle.json`);
  }

  async #readEntry(path: string): Promise<string> {
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(path, "r");
      const opened = await handle.stat();
      const linked = await lstat(path);
      if (
        !opened.isFile() ||
        !linked.isFile() ||
        linked.isSymbolicLink() ||
        opened.dev !== linked.dev ||
        opened.ino !== linked.ino
      ) {
        fail("REGISTRY_UNSAFE_ENTRY", "The bundle path is not a stable regular local file.");
      }
      if (opened.size > this.#limits.maxEntryBytes) {
        fail(
          "REGISTRY_ENTRY_TOO_LARGE",
          "The stored bundle exceeds the configured entry byte limit.",
          {
            maxEntryBytes: this.#limits.maxEntryBytes,
            entryBytes: opened.size,
          },
        );
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      while (totalBytes <= this.#limits.maxEntryBytes) {
        const chunk = Buffer.allocUnsafe(
          Math.min(64 * 1024, this.#limits.maxEntryBytes - totalBytes + 1),
        );
        const result = await handle.read(chunk, 0, chunk.byteLength, null);
        if (result.bytesRead === 0) break;
        chunks.push(chunk.subarray(0, result.bytesRead));
        totalBytes += result.bytesRead;
      }
      if (totalBytes > this.#limits.maxEntryBytes) {
        fail(
          "REGISTRY_ENTRY_TOO_LARGE",
          "The stored bundle exceeds the configured entry byte limit.",
          {
            maxEntryBytes: this.#limits.maxEntryBytes,
            entryBytes: totalBytes,
          },
        );
      }

      const afterRead = await handle.stat();
      const linkedAfterRead = await lstat(path);
      if (
        !afterRead.isFile() ||
        !linkedAfterRead.isFile() ||
        linkedAfterRead.isSymbolicLink() ||
        opened.dev !== afterRead.dev ||
        opened.ino !== afterRead.ino ||
        opened.size !== afterRead.size ||
        afterRead.dev !== linkedAfterRead.dev ||
        afterRead.ino !== linkedAfterRead.ino
      ) {
        fail("REGISTRY_UNSAFE_ENTRY", "The registry entry changed while it was being read.");
      }
      return decoder.decode(Buffer.concat(chunks, totalBytes));
    } catch (error) {
      if (error instanceof SchemaRegistryError) throw error;
      return fail("REGISTRY_IO_ERROR", "The local registry entry could not be read safely.");
    } finally {
      await handle?.close().catch(() => undefined);
    }
  }

  async #entries(): Promise<readonly DiskEntry[]> {
    await this.#ensureDirectory();
    const entries: DiskEntry[] = [];
    let totalBytes = 0;
    const directory = await opendir(this.#directory);
    for await (const item of directory) {
      const match = FILE_PATTERN.exec(item.name);
      if (match === null) continue;
      if (!item.isFile() || item.isSymbolicLink()) {
        fail("REGISTRY_UNSAFE_ENTRY", "A registry entry is not a regular local file.");
      }
      const digest = match[1];
      if (digest === undefined) continue;
      const path = resolvePath(this.#directory, item.name);
      const information = await lstat(path);
      if (!information.isFile() || information.isSymbolicLink()) {
        fail("REGISTRY_UNSAFE_ENTRY", "A registry entry is not a regular local file.");
      }
      if (information.size > this.#limits.maxEntryBytes) {
        fail(
          "REGISTRY_ENTRY_TOO_LARGE",
          "A stored bundle exceeds the configured entry byte limit.",
          {
            maxEntryBytes: this.#limits.maxEntryBytes,
            entryBytes: information.size,
          },
        );
      }
      if (entries.length >= this.#limits.maxEntries) {
        fail(
          "REGISTRY_LIMIT_EXCEEDED",
          "The registry contains more than the configured entry limit.",
          {
            maxEntries: this.#limits.maxEntries,
          },
        );
      }
      totalBytes += information.size;
      if (totalBytes > this.#limits.maxTotalBytes) {
        fail("REGISTRY_LIMIT_EXCEEDED", "The registry exceeds the configured total byte limit.", {
          maxTotalBytes: this.#limits.maxTotalBytes,
        });
      }
      entries.push({ id: `sha256:${digest}`, path, bytes: information.size });
    }
    return entries.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  }

  async register(input: SchemaGuideBundleInput): Promise<SchemaGuideBundle> {
    const bundle = createSchemaGuideBundle(input);
    await this.put(bundle);
    return bundle;
  }

  async put(bundle: SchemaGuideBundle): Promise<void> {
    const verified = assertValidSchemaGuideBundle(bundle);
    const path = this.#pathFor(verified.bundleId);
    await this.#ensureDirectory();
    const existing = await lstat(path).catch(() => undefined);
    if (existing !== undefined) {
      if (!existing.isFile() || existing.isSymbolicLink()) {
        fail("REGISTRY_UNSAFE_ENTRY", "The bundle path is not a regular local file.");
      }
      const resolved = await this.resolve(verified.bundleId);
      if (resolved === undefined) {
        fail("REGISTRY_IO_ERROR", "The existing registry entry could not be resolved.");
      }
      return;
    }
    const text = serializeSchemaGuideBundle(verified);
    const bytes = encoder.encode(text).byteLength;
    if (bytes > this.#limits.maxEntryBytes) {
      fail("REGISTRY_ENTRY_TOO_LARGE", "The bundle exceeds the configured entry byte limit.", {
        maxEntryBytes: this.#limits.maxEntryBytes,
        entryBytes: bytes,
      });
    }
    const entries = await this.#entries();
    const totalBytes = entries.reduce((total, entry) => total + entry.bytes, 0);
    if (entries.length >= this.#limits.maxEntries) {
      fail("REGISTRY_LIMIT_EXCEEDED", "The registry entry limit has been reached.", {
        maxEntries: this.#limits.maxEntries,
      });
    }
    if (totalBytes + bytes > this.#limits.maxTotalBytes) {
      fail("REGISTRY_LIMIT_EXCEEDED", "The registry total byte limit would be exceeded.", {
        maxTotalBytes: this.#limits.maxTotalBytes,
      });
    }

    const temporaryPath = resolvePath(
      this.#directory,
      `.${verified.bundleId.slice("sha256:".length)}.${randomUUID()}.tmp`,
    );
    try {
      await writeFile(temporaryPath, text, { encoding: "utf8", flag: "wx", mode: 0o600 });
      await link(temporaryPath, path);
      await unlink(temporaryPath);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      const racedEntry = await lstat(path).catch(() => undefined);
      if (racedEntry?.isFile() && !racedEntry.isSymbolicLink()) {
        const resolved = await this.resolve(verified.bundleId);
        if (resolved !== undefined) return;
      }
      if (error instanceof SchemaRegistryError) throw error;
      fail("REGISTRY_IO_ERROR", "The bundle could not be written to the local registry.");
    }
  }

  async resolve(bundleId: string): Promise<SchemaGuideBundle | undefined> {
    assertSchemaBundleId(bundleId);
    await this.#ensureDirectory();
    const path = this.#pathFor(bundleId);
    const information = await lstat(path).catch(() => undefined);
    if (information === undefined) return undefined;
    if (!information.isFile() || information.isSymbolicLink()) {
      fail("REGISTRY_UNSAFE_ENTRY", "The bundle path is not a regular local file.");
    }
    if (information.size > this.#limits.maxEntryBytes) {
      fail(
        "REGISTRY_ENTRY_TOO_LARGE",
        "The stored bundle exceeds the configured entry byte limit.",
        {
          maxEntryBytes: this.#limits.maxEntryBytes,
          entryBytes: information.size,
        },
      );
    }
    const text = await this.#readEntry(path);
    const bundle = parseSchemaGuideBundle(text, { maxInputBytes: this.#limits.maxEntryBytes });
    if (bundle.bundleId !== bundleId) {
      fail("REGISTRY_DIGEST_MISMATCH", "The stored bundle does not match its filename identifier.");
    }
    return bundle;
  }

  async has(bundleId: string): Promise<boolean> {
    return (await this.resolve(bundleId)) !== undefined;
  }

  async listIds(): Promise<readonly SchemaBundleId[]> {
    return (await this.#entries()).map((entry) => entry.id);
  }

  async delete(bundleId: string): Promise<boolean> {
    assertSchemaBundleId(bundleId);
    await this.#ensureDirectory();
    const path = this.#pathFor(bundleId);
    const information = await lstat(path).catch(() => undefined);
    if (information === undefined) return false;
    if (!information.isFile() || information.isSymbolicLink()) {
      fail("REGISTRY_UNSAFE_ENTRY", "The bundle path is not a regular local file.");
    }
    await unlink(path);
    return true;
  }

  async stats(): Promise<SchemaRegistryStats> {
    const entries = await this.#entries();
    return {
      ...this.#limits,
      entryCount: entries.length,
      totalBytes: entries.reduce((total, entry) => total + entry.bytes, 0),
    };
  }
}
