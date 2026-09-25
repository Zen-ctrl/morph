# Semantic contract

MORPH preserves accepted data semantics. It does not promise byte-for-byte source
preservation, and it does not authorize task-specific data removal.

## Intermediate representation

Every accepted input becomes this tagged tree:

```ts
type IRNode =
  | { kind: "null" }
  | { kind: "boolean"; value: boolean }
  | { kind: "string"; value: string }
  | { kind: "number"; lexeme: string }
  | { kind: "array"; items: readonly IRNode[] }
  | { kind: "object"; entries: readonly (readonly [string, IRNode])[] };

interface MorphIR {
  irVersion: "morph-ir/1";
  root: IRNode;
  inputKind: "json-text" | "js-value";
  semanticDigest: string;
}
```

Objects use entry arrays rather than ordinary property assignment. This retains hostile-
looking keys such as `__proto__`, `constructor`, and `prototype` without mutating an
object prototype.

## JSON-text entry point

`parseJsonStrict` and `compileJson` accept one JSON value under the grammar from
[RFC 8259](https://www.rfc-editor.org/rfc/rfc8259.html), narrowed by the documented
resource and Unicode policies.

The parser:

- checks UTF-8 input byte length before parsing;
- retains the exact grammar-valid token for every number;
- detects a duplicate object key before a map can overwrite it;
- tracks node count and nesting depth while parsing;
- rejects trailing content, invalid escapes, unescaped controls, and malformed numbers;
- reports a JSON Pointer path where applicable.

Whitespace outside values, escape spelling, and object member display order are not part
of the preservation contract. For example, `"a"` and `"\u0061"` both become the same
string. Numbers are different: `1`, `1.0`, `1e0`, and `1E+0` remain distinct lexemes.

## JavaScript-value entry point

`fromJsValue` and `compileValue` accept this subset:

- `null`;
- booleans;
- well-formed strings;
- finite JavaScript numbers;
- ordinary dense arrays whose prototype is exactly `Array.prototype`;
- enumerable own data properties on ordinary objects or null-prototype objects.

The adapter inspects property descriptors. It does not call `toJSON` and does not read an
accessor value. It rejects:

- `undefined`, functions, symbols, and `BigInt`;
- `NaN`, positive infinity, and negative infinity;
- sparse arrays, array subclasses, symbol or extra array properties;
- cycles;
- accessor or non-enumerable object properties;
- class instances and other unsupported prototypes;
- configured byte, depth, or node-limit violations.

Exact large JSON numbers should enter through JSON text. A JavaScript `number` may
already have lost precision before MORPH sees it. The JS-value adapter uses `String(n)`
as the numeric representation, except that negative zero is recorded as `-0`.

Arbitrary hostile objects and proxies are outside the JavaScript-value trust boundary.
Use JSON text for untrusted input.

## Equality

`semanticEqual` uses these rules:

- Object key sets and recursively compared values must match. Member display order may
  differ.
- Array length, item order, and duplicate multiplicity must match.
- String contents must match exactly, including whitespace and line endings.
- Boolean and null types and values must match.
- Number lexemes must match exactly.

Because number comparison is lexical, this implementation applies the strict rule to
all IR values. JSON text preserves the caller's lexeme. JavaScript values compare against
the canonical lexeme created when the adapter received the value.

`decode` returns an IR. `decodeJson` prints valid compact JSON directly from that IR and
therefore does not route number nodes through JavaScript numeric conversion. The helper
`irNodeToJsonCompatible` is conservative: it throws `PRECISION_UNSAFE_CONVERSION` unless
`Number(lexeme)` is finite and `String(value)` exactly equals the lexeme. That helper is
not the lossless decode path.

## Unicode policy

Strings and keys must contain well-formed Unicode scalar values. A valid surrogate pair
is accepted. A lone high or low surrogate, whether literal or escaped, is rejected with
`LONE_SURROGATE` rather than silently replaced.

MORPH does not normalize Unicode. Precomposed `café` and decomposed `cafe\u0301` remain
different strings and produce different semantic digests. String line endings are not
rewritten.

## Object order and rendered JSON

The parser retains object entry display order for rendering and codecs that use a first
record's field order. Semantic equality and semantic hashing do not treat that order as
meaningful. `decodeJson` may therefore be semantically exact without reproducing the
source object's original display order after a layout has reconstructed the same key set
in another deterministic order.

Arrays are different. Every codec must preserve array order exactly.

## Missing, null, false, and empty

These states remain distinct:

- an object property is absent;
- a property is present with `null`;
- a property is present with `false`;
- a property is present with `""`;
- an array or object is present but empty.

Compact JSON and path/value support every such shape. JSON Lines supports them when the
root is an array. Rows and columns require identical record key sets, so a sparse record
array is declared inapplicable instead of inventing a placeholder. Empty root arrays are
explicit in JSON Lines and fall back to general codecs for row and column targets.

## Numbers

A number node contains a token matching:

```text
-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?
```

Examples retained by native codecs include:

```text
9007199254740993
-0
1.2300
9e30
```

No native codec rounds, expands an exponent, removes trailing zeros, or changes a number
into a quoted string. The TOON adapter is narrower because its official host interface
uses JavaScript numbers. It is inapplicable unless conversion and official round trip
preserve the MORPH lexeme contract.

## Semantic digest

`semanticDigest` is SHA-256 over `morph-c14n/1` canonical node text. Canonicalization uses
explicit type tags, UTF-8 lengths, array order, numeric lexemes, and code-unit-sorted
object keys. Identical accepted semantics produce the same digest even if source JSON
uses different insignificant whitespace or object display order.

The digest does not include `inputKind`; artifacts record that field separately. A digest
is a consistency check, not a message authentication code, authorization decision, or
proof that model instructions are benign.

## Schema semantics

A schema is optional context. Current code:

- accepts an object or boolean schema through the JavaScript-value safety rules;
- rejects nonlocal `$ref` strings with `SCHEMA_DEPENDENCY_MISSING`;
- rejects an explicit dialect other than Draft 2020-12 with
  `UNSUPPORTED_SCHEMA_DIALECT`;
- compiles and validates with Ajv 8.20 in strict, all-errors mode;
- disables format validation and all data mutation options;
- includes the complete sanitized schema in every candidate's self-contained bundle;
- counts that complete rendered schema in the final tokenizer call;
- never fetches a remote schema.

The validator cannot establish exact arbitrary-precision results by passing raw numeric
lexemes through JavaScript numbers. The implemented gate is conservative and global. A
schema containing `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`,
`multipleOf`, numeric `const` or `enum`, or `uniqueItems: true` causes
`SCHEMA_NUMERIC_VALIDATION_UNSUPPORTED` when any instance number is not a canonical safe
integer under JavaScript conversion. Any instance lexeme that converts to a nonfinite
JavaScript number also causes that error whenever schema validation is requested. The
gate does not attempt path-sensitive proof that the keyword reaches that number. It never
rounds and calls the result exact. Other validation failures return
`SCHEMA_VALIDATION_FAILED` with at most 20 sanitized Ajv error summaries. Schema
inference is not implemented. Descriptions remain untrusted context. The supported
dialect is
[JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12).

## Compact JSON source map

`printCompactJsonWithSourceMap` prints the same compact JSON representation and returns a
`morph-source-map/1` table. Each original JSON Pointer maps to one or more half-open spans
whose unit is explicitly `utf16-code-units`. Object child pointers have a `key` span and
a `value` span. Every node, including containers and the root empty pointer, has a value
span. Escaped output and non-BMP text are measured in JavaScript UTF-16 code units, not
Unicode code points or UTF-8 bytes.

The helper currently covers compact JSON only and is not embedded into the selected
artifact. It is an exported diagnostic API.

## Re-encoding is not projection

Task fields such as `accessPattern` and `relevantPaths` may guide bounded planning. They
do not authorize MORPH to remove data. The current native encoders preserve the whole
accepted IR and do not filter rows, project fields, aggregate values, summarize text,
deduplicate records, sort arrays, translate values, or invent units.

If a future application wants a smaller derived dataset, it must run a separate explicit
query or transformation first and record that operation's provenance. MORPH may then
losslessly compile the derived dataset. It must not call that artifact a reversible
encoding of the original full dataset.

## What preservation does not establish

A passing round trip establishes software recoverability under this contract. It does
not establish that:

- a model will understand the representation;
- a model will answer a task correctly;
- the content is free of prompt injection;
- a provider will count the same request tokens;
- a checksum authenticates the producer;
- one representation is universally cheaper or better.

Those claims require separate evidence and are reported separately by design.
