import type { MorphError } from "./types.js";

export class MorphException extends Error {
  readonly error: MorphError;

  constructor(error: MorphError) {
    super(error.message);
    this.name = "MorphException";
    this.error = error;
  }
}

export function morphError(
  code: string,
  message: string,
  path?: string,
  details?: Readonly<Record<string, unknown>>,
): MorphError {
  return {
    code,
    message,
    ...(path === undefined ? {} : { path }),
    ...(details === undefined ? {} : { details }),
  };
}

export function fail(
  code: string,
  message: string,
  path?: string,
  details?: Readonly<Record<string, unknown>>,
): never {
  throw new MorphException(morphError(code, message, path, details));
}

export function toMorphError(value: unknown, fallbackCode = "INTERNAL_ERROR"): MorphError {
  if (value instanceof MorphException) return value.error;
  if (value instanceof Error) return morphError(fallbackCode, value.message);
  return morphError(fallbackCode, "An unknown error occurred.");
}
