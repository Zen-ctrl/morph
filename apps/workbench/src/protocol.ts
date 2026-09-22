import type {
  AccessPattern,
  ExplainReport,
  MorphArtifact,
  MorphError,
  PlannerPolicy,
  VerificationReport,
} from "@morph/core";

export interface WorkbenchCompileInput {
  readonly jsonText: string;
  readonly schemaText: string;
  readonly task: string;
  readonly accessPattern: AccessPattern;
  readonly policy: PlannerPolicy;
  readonly maxPromptTokens?: number;
}

export interface CompileWorkerRequest {
  readonly kind: "compile";
  readonly requestId: number;
  readonly requestDigest: string;
  readonly input: WorkbenchCompileInput;
}

export interface ArtifactImportWorkerRequest {
  readonly kind: "import-artifact";
  readonly requestId: number;
  readonly requestDigest: string;
  readonly artifactText: string;
}

export type WorkbenchWorkerRequest = CompileWorkerRequest | ArtifactImportWorkerRequest;

export interface CompileSuccessPayload {
  readonly source: "compile" | "artifact-import";
  readonly artifact: MorphArtifact;
  readonly report: ExplainReport;
  readonly renderedContext: string;
  readonly restoredJson: string;
  readonly verification: VerificationReport;
}

export interface CompileFailurePayload {
  readonly error: MorphError;
  readonly report?: ExplainReport;
}

export type CompileWorkerResponse =
  | {
      readonly kind: "result";
      readonly requestId: number;
      readonly requestDigest: string;
      readonly ok: true;
      readonly result: CompileSuccessPayload;
    }
  | {
      readonly kind: "result";
      readonly requestId: number;
      readonly requestDigest: string;
      readonly ok: false;
      readonly result: CompileFailurePayload;
    };
