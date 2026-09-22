"""Generate the committed o200k_base parity fixture with official Python tiktoken."""

from __future__ import annotations

import json

import tiktoken


TEXTS = [
    "",
    "hello world",
    " leading and  repeated whitespace\nnext line\tcell",
    "punctuation: []{}(),.;!? | comma, tab\t semicolon;",
    "中文文本, café, e\u0301, emoji: 🧪🚀",
    "-0 1.2300 9007199254740993 9e30",
    "<|endoftext|> and <|endofprompt|> are ordinary text here",
]


def main() -> None:
    encoding = tiktoken.get_encoding("o200k_base")
    fixture = {
        "fixtureVersion": "morph-tokenizer-fixture/1",
        "oracle": f"official Python tiktoken {tiktoken.__version__} encode_ordinary",
        "oraclePackage": "tiktoken",
        "oracleVersion": tiktoken.__version__,
        "generatedBy": "development-only oracle; not a MORPH runtime dependency",
        "assetSha256": "446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d",
        "cases": [
            {"text": text, "ids": encoding.encode_ordinary(text), "count": len(encoding.encode_ordinary(text))}
            for text in TEXTS
        ],
    }
    print(json.dumps(fixture, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
