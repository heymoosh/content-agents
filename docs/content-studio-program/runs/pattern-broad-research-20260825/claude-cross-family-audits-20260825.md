# Claude cross-family audits — 2026-08-25

Claude replaced Grok as the approved cross-family auditor after the recorded Grok authentication
failure. The coordinator first reran deterministic lease, body-free, ordering, and
manual-platform-report checks locally, then supplied the resulting evidence to read-only
`claude -p` audit prompts. No Claude run used browsing, web search, or repository-write tools.

| Task | Commit | Actual auditor | Effort | Verdict |
| --- | --- | --- | --- | --- |
| `pattern-research-text-community` | `54c3dce24ad62ce7f750f8bb868781e180e6ee6b` | `claude-sonnet-5` | high | passed |
| `pattern-research-professional-publishing` | `632567ee3b1b1794ae5dd989e343417592a3283b` | `claude-haiku-4-5` | medium | passed |
| `pattern-research-visual-video` | `f288fb6e27bb4b2783a60df8b270c21abf3fd6ea` | `claude-haiku-4-5` | medium | passed |

The two short Haiku checks were used after Sonnet tool-enabled prompts returned no usable verdict
in this noninteractive host. The deterministic evidence supplied to each covered exact seed and
addition counts, lease-only paths, source caps/provenance, body-free report totals, explicit
unknowns/caveats, and absence of rankings or unsupported claims.
