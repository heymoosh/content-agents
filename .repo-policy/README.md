# Repository delivery policy

This private repository is a local-first content operations tool. It has no
Vercel production project and no application deployment target.

## Merge gate

Run the single declared local gate before merging:

```bash
npm run check
```

`.orch/config.toml` records the same command. Ordinary lint, typecheck, unit
tests, and builds stay local. `.github/workflows/ci.yml` is a manual diagnostic
only; it does not run for pull requests or ordinary pushes.

The retained hosted workflows have specific non-routine purposes:

- `secret-scan.yml`: event-driven secret detection.
- `dependency-audit.yml`: scheduled, advisory dependency review.
- Dependabot: scheduled dependency update proposals.

## Delivery

Delivery is a merge to `main`, as declared in `.orchestrator.json`. The tool is
then run locally from the repository with the documented `npm` commands. There
is no production web deployment and no Vercel workflow to invoke.

The private `origin` remote (`heymoosh/content-agents`) is authorized. The session that owns
integration may push reviewed, gated work when delivery is in scope; workers and subagents never
push or merge. Do not open an engineering delivery pull request or add a GitHub Actions workflow
without separate owner authorization. The scoped story editorial PR flow remains available for
chapter review. The existing manual diagnostic, secret scan, scheduled dependency audit and
Dependabot configuration are retained for their specific non-routine purposes.

If a production deployment is introduced later, re-audit the real target
before adding automation. A Vercel project must set
`git.deploymentEnabled: false`, and any production deployment workflow must run
only for tags matching `v*`, never for pull requests or ordinary pushes to
`main`.
