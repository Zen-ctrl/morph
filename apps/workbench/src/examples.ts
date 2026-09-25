import type { AccessPattern } from "@morph/core";

export interface WorkbenchExample {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly data: string;
  readonly schema: string;
  readonly task: string;
  readonly accessPattern: AccessPattern;
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export const WORKBENCH_EXAMPLES: readonly WorkbenchExample[] = Object.freeze([
  {
    id: "uniform-table",
    name: "Uniform table",
    description: "Customer records with an identical primitive field set.",
    data: pretty([
      { id: "c1", country: "US", revenue: 129, active: true },
      { id: "c2", country: "CA", revenue: 85, active: false },
      { id: "c3", country: "US", revenue: 220, active: true },
      { id: "c4", country: "DE", revenue: 164, active: true },
    ]),
    schema: pretty({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "array",
      description: "Complete synthetic customer records for a revenue review.",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Synthetic customer identifier." },
          country: { type: "string", description: "ISO-style country label." },
          revenue: { type: "number", description: "Synthetic revenue in whole units." },
          active: { type: "boolean" },
        },
        required: ["id", "country", "revenue", "active"],
      },
    }),
    task: "Find customer c3 and report its country, revenue, and active status.",
    accessPattern: "entity-lookup",
  },
  {
    id: "nested-data",
    name: "Nested data",
    description: "Objects, arrays, and empty containers across several levels.",
    data: pretty({
      account: {
        id: "c1",
        contact: { name: "Ari", channels: ["email", "sms"] },
      },
      flags: [true, null],
      preferences: { locale: "en-US", alerts: { product: true, billing: false } },
      empty: {},
    }),
    schema: "",
    task: "Report the account id and the value at preferences.alerts.billing.",
    accessPattern: "nested-path-lookup",
  },
  {
    id: "sparse-objects",
    name: "Sparse objects",
    description: "Absent fields, explicit null, false, and empty strings remain distinct.",
    data: pretty([
      { id: "a", note: null, active: false },
      { id: "b", note: "", score: 0 },
      { id: "c", active: true, score: null },
      { id: "d", note: "ready", active: false, score: 4 },
    ]),
    schema: "",
    task: "Identify which records have an absent note and which have a present null note.",
    accessPattern: "filtering",
  },
  {
    id: "repeated-strings",
    name: "Repeated strings",
    description: "Readable categorical labels repeat without dictionary transforms.",
    data: pretty([
      { item: "p-01", region: "Northern Coast", category: "Field equipment", status: "Ready" },
      { item: "p-02", region: "Northern Coast", category: "Field equipment", status: "Ready" },
      { item: "p-03", region: "Western Ridge", category: "Safety supplies", status: "Review" },
      { item: "p-04", region: "Northern Coast", category: "Field equipment", status: "Review" },
      { item: "p-05", region: "Western Ridge", category: "Safety supplies", status: "Ready" },
    ]),
    schema: "",
    task: "Compare Ready item counts between Northern Coast and Western Ridge.",
    accessPattern: "multi-entity-comparison",
  },
  {
    id: "multilingual",
    name: "Multilingual text",
    description: "Unicode, combining marks, emoji, delimiters, quotes, and newlines.",
    data: pretty([
      { id: "東京-1", label: "東京", note: "first line\nsecond line", marker: "a|b,c\td" },
      { id: "cafe-1", label: "café", note: "precomposed", marker: '"quoted"' },
      { id: "cafe-2", label: "cafe\u0301", note: "decomposed", marker: "🌱" },
      { id: "القاهرة-1", label: "القاهرة", note: "مرحبا", marker: "✓" },
    ]),
    schema: "",
    task: "Return each id and label exactly as supplied. Do not normalize text.",
    accessPattern: "sequence-analysis",
  },
  {
    id: "tiny-json",
    name: "Tiny JSON",
    description: "A tiny payload where unfamiliar-format guide overhead can dominate.",
    data: '{"ok":true,"count":2}',
    schema: "",
    task: "Report whether ok is true.",
    accessPattern: "entity-lookup",
  },
]);

export function exampleById(id: string): WorkbenchExample {
  const selected = WORKBENCH_EXAMPLES.find((example) => example.id === id);
  const fallback = WORKBENCH_EXAMPLES.at(0);
  if (selected !== undefined) return selected;
  if (fallback === undefined) throw new Error("The workbench example catalog is empty.");
  return fallback;
}
