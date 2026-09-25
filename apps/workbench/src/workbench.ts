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
          detail: "No selected layout was available for the data rebuild check.",
          tone: report === undefined ? "neutral" : "warning",
        }
      : verification.valid && verification.semanticRoundTrip === "passed"
        ? {
            label: "Data preservation",
            value: "Verified",
            detail: "MORPH rebuilt the accepted data from the complete model-ready bundle.",
            tone: "verified",
          }
        : {
            label: "Data preservation",
            value: "Failed",
            detail: "The saved result or rebuilt data did not pass verification.",
            tone: "failed",
          };

  const measurement = selected?.tokens;
  const tokenOutcome: OutcomeItem =
    measurement === undefined
      ? {
          label: "Token measurement",
          value: "Not run",
          detail: "No selected layout has a token measurement.",
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
          value: "Supported by model tests",
          detail: "Matching model tests qualified this selected layout.",
          tone: "verified",
        }
      : quality === "failed"
        ? {
            label: "Model comprehension",
            value: "Failed",
            detail: "Matching model tests did not pass the required quality threshold.",
            tone: "failed",
          }
        : {
            label: "Model comprehension",
            value: "Untested",
            detail:
              quality === "insufficient"
                ? "The available model testing is not strong enough to qualify this layout."
                : "Rebuilding the data and counting tokens do not prove model accuracy.",
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
        ? "May choose the smallest recoverable prompt without claiming equal model understanding."
        : policy === "validated"
          ? "Requires matching model-quality evidence before a non-JSON layout can win."
          : "Keeps compact JSON unless matching model evidence supports another layout.",
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
