import type {
  CandidateReport,
  ExplainReport,
  PlannerPolicy,
  VerificationReport,
} from "@morph/core";

export type OutcomeTone = "verified" | "neutral" | "warning" | "failed";

export interface OutcomeItem {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly tone: OutcomeTone;
}

function selectedCandidate(report: ExplainReport | undefined): CandidateReport | undefined {
  return report?.candidates.find((candidate) => candidate.selected);
}

export function summarizeOutcomes(
  policy: PlannerPolicy,
  report?: ExplainReport,
  verification?: VerificationReport,
): readonly OutcomeItem[] {
  const selected = selectedCandidate(report);

  const preservation: OutcomeItem =
    verification === undefined
      ? {
          label: "Data preservation",
          value: report === undefined ? "Not run" : "Not verified",
          detail: "No selected artifact was available for semantic verification.",
          tone: report === undefined ? "neutral" : "warning",
        }
      : verification.valid && verification.semanticRoundTrip === "passed"
        ? {
            label: "Data preservation",
            value: "Verified",
            detail: "The self-contained bundle reconstructed the accepted input semantics.",
            tone: "verified",
          }
        : {
            label: "Data preservation",
            value: "Failed",
            detail: "Artifact integrity or semantic reconstruction did not pass.",
            tone: "failed",
          };

  const measurement = selected?.tokens;
  const tokenOutcome: OutcomeItem =
    measurement === undefined
      ? {
          label: "Token measurement",
          value: "Not run",
          detail: "No selected candidate has a token measurement.",
          tone: "neutral",
        }
      : {
          label: "Token measurement",
          value:
            measurement.certainty === "exact-for-tokenizer"
              ? "Exact text"
              : measurement.certainty === "provider-reported"
                ? "Provider reported"
                : "Estimated",
          detail: `${measurement.count.toLocaleString()} tokens · ${measurement.tokenizerId}`,
          tone: measurement.certainty === "estimate" ? "warning" : "verified",
        };

  const quality = selected?.quality.status;
  const qualityOutcome: OutcomeItem =
    quality === "qualified"
      ? {
          label: "Model comprehension",
          value: "Evidence-qualified",
          detail: "Applicable quality evidence qualified this selected representation.",
          tone: "verified",
        }
      : quality === "failed"
        ? {
            label: "Model comprehension",
            value: "Failed",
            detail: "Applicable evidence did not pass the configured quality gate.",
            tone: "failed",
          }
        : {
            label: "Model comprehension",
            value: "Untested",
            detail:
              quality === "insufficient"
                ? "Available evidence is insufficient for qualification."
                : "Codec recovery and token counts do not establish model accuracy.",
            tone: "warning",
          };

  const policyOutcome: OutcomeItem = {
    label: "Selection policy",
    value:
      policy === "economy-experimental"
        ? "Experimental"
        : policy === "validated"
          ? "Validated"
          : "Compatibility",
    detail:
      policy === "economy-experimental"
        ? "Ranks reversible candidates by measured prompt tokens without claiming comprehension."
        : policy === "validated"
          ? "Requires matching quality evidence before a nonbaseline format can win."
          : "Keeps compact JSON unless a nonbaseline candidate has applicable evidence.",
    tone: policy === "economy-experimental" ? "warning" : "neutral",
  };

  return [preservation, tokenOutcome, qualityOutcome, policyOutcome];
}

export function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)} KiB`;
  return `${(bytes / (1_024 * 1_024)).toFixed(2)} MiB`;
}

export function formatSavings(candidate: CandidateReport): string {
  if (candidate.savingsTokens === undefined || candidate.savingsFraction === undefined)
    return "Not measured";
  const sign = candidate.savingsTokens > 0 ? "+" : "";
  const percentage = Number.isFinite(candidate.savingsFraction)
    ? `${(candidate.savingsFraction * 100).toFixed(1)}%`
    : "n/a";
  return `${sign}${candidate.savingsTokens.toLocaleString()} (${percentage})`;
}

export async function digestCompileInput(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
