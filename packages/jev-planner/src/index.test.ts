import { describe, expect, it, vi } from "vitest";
import {
  JEV_ACCESS_PATTERN_CHOICES,
  JEV_INTEGRATION_STATUS,
  JEV_SYSTEM_ONE_ENDPOINT,
  type JevAccessPatternChoice,
  JevHttpAccessPatternClassifier,
} from "./index.js";

function probabilities(
  overrides: Partial<Record<JevAccessPatternChoice, number>> = {},
): Record<JevAccessPatternChoice, number> {
  return {
    entity_lookup: 0,
    multi_entity_comparison: 0,
    aggregation: 0,
    filtering: 0,
    nested_path_lookup: 0,
    sequence_analysis: 0,
    unknown: 0,
    ...overrides,
  };
}

function responseBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    model: "jev-1.13.0",
    answers: {
      access_pattern: {
        type: "choice",
        choice: "entity_lookup",
        probabilities: probabilities({ entity_lookup: 0.9, unknown: 0.1 }),
        confidence: 0.88,
      },
    },
    usage: { input_tokens: 120, output_tokens: 18 },
    ...overrides,
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const enabledRequest = {
  taskInstruction: "Find the customer with identifier c1.",
  shape: {
    rootKind: "array" as const,
    totalNodes: 20,
    recordArrayCount: 1,
    uniformRecordArrayCount: 1,
  },
  allowNetwork: true,
  allowRemoteTaskDisclosure: true,
};

describe("JevHttpAccessPatternClassifier", () => {
  it("requires both network and remote task disclosure gates before calling fetch", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    const classifier = new JevHttpAccessPatternClassifier({
      apiKey: "secret",
      fetchImplementation,
    });

    await expect(
      classifier.classify({ ...enabledRequest, allowNetwork: false }),
    ).resolves.toMatchObject({
      status: "fallback",
      reason: "network-disabled",
      accessPattern: "unknown",
    });
    await expect(
      classifier.classify({ ...enabledRequest, allowRemoteTaskDisclosure: false }),
    ).resolves.toMatchObject({
      status: "fallback",
      reason: "remote-task-disclosure-disabled",
      accessPattern: "unknown",
    });
    await expect(
      classifier.classify({
        ...enabledRequest,
        allowNetwork: 1 as unknown as boolean,
      }),
    ).resolves.toMatchObject({
      status: "fallback",
      reason: "network-disabled",
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("returns a deterministic fallback when the caller supplies no credential", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    const classifier = new JevHttpAccessPatternClassifier({ fetchImplementation });

    await expect(classifier.classify(enabledRequest)).resolves.toEqual({
      status: "fallback",
      source: "deterministic-fallback",
      accessPattern: "unknown",
      reason: "missing-credential",
      diagnosticCode: "JEV_CREDENTIAL_MISSING",
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("posts the bounded Choice contract and captures model, latency, probabilities, and usage", async () => {
    let capturedUrl: string | URL | Request | undefined;
    let capturedInit: RequestInit | undefined;
    const fetchImplementation: typeof fetch = async (url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return jsonResponse(responseBody());
    };
    const moments = [100, 124];
    const classifier = new JevHttpAccessPatternClassifier({
      apiKey: "test-secret-never-returned",
      model: "jev-latest",
      fetchImplementation,
      now: () => moments.shift() ?? 124,
    });

    const result = await classifier.classify(enabledRequest);

    expect(capturedUrl).toBe(JEV_SYSTEM_ONE_ENDPOINT);
    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.redirect).toBe("error");
    const body = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "jev-latest",
      state: {
        task: enabledRequest.taskInstruction,
        coarse_shape: enabledRequest.shape,
      },
      questions: { access_pattern: { type: "choice" } },
    });
    const questions = body.questions as Record<string, Record<string, unknown>>;
    const accessPatternQuestion = questions.access_pattern;
    expect(Object.keys(accessPatternQuestion?.criteria as object).sort()).toEqual(
      [...JEV_ACCESS_PATTERN_CHOICES].sort(),
    );
    expect(result).toEqual({
      status: "classified",
      source: "jev",
      accessPattern: "entity-lookup",
      reason: "accepted",
      requestedModel: "jev-latest",
      resolvedModel: "jev-1.13.0",
      probabilities: probabilities({ entity_lookup: 0.9, unknown: 0.1 }),
      confidence: 0.88,
      latencyMs: 24,
      usage: { inputTokens: 120, outputTokens: 18 },
    });
    expect(JSON.stringify(result)).not.toContain("test-secret-never-returned");
  });

  it("treats confidence as planner uncertainty and abstains below the configured threshold", async () => {
    const value = responseBody({
      answers: {
        access_pattern: {
          type: "choice",
          choice: "filtering",
          probabilities: probabilities({ filtering: 0.51, aggregation: 0.49 }),
          confidence: 0.2,
        },
      },
    });
    const classifier = new JevHttpAccessPatternClassifier({
      apiKey: "secret",
      minimumConfidence: 0.75,
      fetchImplementation: async () => jsonResponse(value),
    });

    await expect(classifier.classify(enabledRequest)).resolves.toMatchObject({
      status: "abstained",
      accessPattern: "unknown",
      proposedAccessPattern: "filtering",
      reason: "low-confidence",
      confidence: 0.2,
    });
  });

  it.each([
    [
      "missing probability key",
      probabilities({ entity_lookup: 0.9, unknown: 0.1 }),
      (value: Record<string, number>) => {
        delete value.unknown;
      },
    ],
    [
      "unexpected probability key",
      probabilities({ entity_lookup: 0.9, unknown: 0.1 }),
      (value: Record<string, number>) => {
        value.other = 0;
      },
    ],
    [
      "sum outside tolerance",
      probabilities({ entity_lookup: 0.8, unknown: 0.1 }),
      (_value: Record<string, number>) => undefined,
    ],
    [
      "nonfinite probability",
      probabilities({ entity_lookup: 1 }),
      (value: Record<string, number>) => {
        value.entity_lookup = Number.NaN;
      },
    ],
  ])("rejects a malformed response with %s", async (_name, values, mutate) => {
    mutate(values);
    const value = responseBody({
      answers: {
        access_pattern: {
          type: "choice",
          choice: "entity_lookup",
          probabilities: values,
          confidence: 0.9,
        },
      },
    });
    const classifier = new JevHttpAccessPatternClassifier({
      apiKey: "secret",
      fetchImplementation: async () => jsonResponse(value),
    });

    await expect(classifier.classify(enabledRequest)).resolves.toMatchObject({
      status: "fallback",
      reason: "malformed-response",
      diagnosticCode: "JEV_MALFORMED_RESPONSE",
    });
  });

  it("rejects an answer choice that is not a maximum-probability option", async () => {
    const value = responseBody({
      answers: {
        access_pattern: {
          type: "choice",
          choice: "filtering",
          probabilities: probabilities({ entity_lookup: 0.8, filtering: 0.2 }),
          confidence: 0.8,
        },
      },
    });
    const classifier = new JevHttpAccessPatternClassifier({
      apiKey: "secret",
      fetchImplementation: async () => jsonResponse(value),
    });

    await expect(classifier.classify(enabledRequest)).resolves.toMatchObject({
      status: "fallback",
      reason: "malformed-response",
    });
  });

  it("returns timeout fallback without retrying", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(
      async (_url, init) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    const classifier = new JevHttpAccessPatternClassifier({
      apiKey: "secret",
      timeoutMs: 5,
      fetchImplementation,
    });

    await expect(classifier.classify(enabledRequest)).resolves.toMatchObject({
      status: "fallback",
      reason: "request-timeout",
      diagnosticCode: "JEV_REQUEST_TIMEOUT",
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("does not include provider error bodies in its deterministic service fallback", async () => {
    const classifier = new JevHttpAccessPatternClassifier({
      apiKey: "secret",
      fetchImplementation: async () =>
        jsonResponse({ error: "echoed private task and credentials" }, 422),
    });

    const result = await classifier.classify(enabledRequest);
    expect(result).toEqual({
      status: "fallback",
      source: "deterministic-fallback",
      accessPattern: "unknown",
      reason: "service-error",
      diagnosticCode: "JEV_SERVICE_ERROR",
      httpStatus: 422,
    });
    expect(JSON.stringify(result)).not.toContain("echoed private");
  });

  it("rejects an oversized provider response before parsing it", async () => {
    const classifier = new JevHttpAccessPatternClassifier({
      apiKey: "secret",
      maxResponseBytes: 32,
      fetchImplementation: async () => jsonResponse(responseBody()),
    });

    await expect(classifier.classify(enabledRequest)).resolves.toMatchObject({
      status: "fallback",
      reason: "malformed-response",
      diagnosticCode: "JEV_MALFORMED_RESPONSE",
    });
  });
});

describe("integration status", () => {
  it("labels the live contract test as not run", () => {
    expect(JEV_INTEGRATION_STATUS).toEqual({
      offlineContractFixtures: "synthetic",
      liveContractTest: "not-run",
    });
  });
});
