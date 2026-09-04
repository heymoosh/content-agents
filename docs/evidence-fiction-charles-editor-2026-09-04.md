# Evidence: Fiction and Charles editor dispatch (2026-09-04)

Lane-A item 2 makes treated Fiction and Charles variants reach their named registry editors.

## Verification

- Focused red: the generation test failed at the former Fiction treatment refusal.
- Focused green: `node --import tsx --test src/review/content-generation.test.ts` passed 19 tests.
- Full gate: unsandboxed `npm run check` passed.
- Cross-family Grok 4.6 packet audit: **PASS: no introduced blockers**. Its P2 checklist is retained below.

## Bounded authenticated canary

One isolated Codex canary generated representative Fiction and Charles requests. It created only
`content/fiction-editor-live-canary-20260904/` and
`content/charles-editor-live-canary-20260904/`; no delivery or publish path ran, and every row is
still `pending`.

Both `canary-result.json` files record `engineExecution: "live"`. The treated derivatives carry
their expected `editor_pass` values (`fiction-social-v1` and `charles-social-v1`), retain their
room authority/restriction frontmatter, and contain no `source_lines`.

## Next-builder acceptance checklist (P2, not merge-blocking)

- Make Charles's editor check derive and enforce copy constraints from `persona.yaml`, not merely
  validate the persona file schema.
- Keep shared Fiction/Charles footnote and colon-capitalization checks only if they are explicitly
  intended house rules; otherwise scope each editor to its own policy.
- Read Fiction style restrictions from `config/fiction/style.yaml` rather than duplicating them in
  regexes, and add parser-level negative cases for Fiction clichés and Charles em dashes.
