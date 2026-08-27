# Raw creator-corpus storage: boundary recommendation, 2026-08-27

This document reports and recommends. It performs no move, no deletion, and no history rewrite.
The tracked raw corpus is exactly where PR #403 left it.

## 1. The discrepancy, stated plainly

`charter.md` says raw pattern bodies stay local and out of the coordinator's context, and that
Content consumes body-free reviewed interfaces. `src/patterns/types.ts` records the same
convention for the collector corpus: "the corpus itself lives in data/patterns/ and is gitignored,
because other creators' full post text and transcripts never reach git", enforced by
`.gitignore` lines 38 to 42.

PR #403 committed full essays, full transcripts, captions, on-screen text and image text for 62
creators under `docs/`. That is the same class of content the repository already refuses to track
under `data/patterns/**`, held to a different rule because it arrived by a different route.

## 2. The tracked footprint, measured

| Measure | Value |
|---|---|
| Files | 62 |
| Entries | 1,706 |
| Working-tree bytes | 16,733,798 |
| Lines | 77,745 |
| Packed size of those 62 blobs in this repository | 6,750,015 bytes |
| Commits that touched the directory | 1 |
| That commit | `497d4ff27ab5f71bcd2788929d67d216a76d5677` (PR #403) |
| Roll-up index | `docs/content-studio-program/creator-content-index.md`, 13,040 bytes, one row per creator |

Ten largest files, working-tree bytes:

```
1473746  hamel-husain.md
1364520  dan-koe.md
1255857  teresa-torres.md
1104160  ali-abdaal.md
 941136  leeja-miller.md
 938490  codie-sanchez.md
 929321  johnny-harris.md
 904239  melissa-perri.md
 793551  legaleagle.md
 626435  mrbeast.md
```

Regenerate this table at any time with `npm run patterns:creator-corpus -- storage`.

## 3. What already replaces it

Removing the raw files does not remove the research. This staging package holds a body-free
projection of the same corpus:

- `creator-corpus-inventory.json` and `creator-corpus-coverage.md`: every entry, its field
  coverage, its capture window, its metrics availability, its flags, and every anomaly, addressed
  by a stable `file.md#entry-<section>-<entry>` reference.
- `mechanism-proposals.jsonl`: 69 proposals, each citing those same references.

What the projection does not preserve is the creator text itself. If the raw files leave git, an
`#entry-1-14` reference resolves against the relocated local copy or against the creator's live
post, not against anything in the repository. That is the trade being decided.

## 4. Recommendation

Relocate, do not delete, and do it in a separate change that Muxin approves on its own merits.

Recommended sequence, in this order:

1. **Preserve first, with the identifier written down.** Before anything is removed, create a
   recovery point and record its identifier in the removal PR body:
   - an annotated tag on the current tip of `main`, for example
     `git tag -a creator-corpus-20260827 -m "raw creator-content corpus before relocation"`
     followed by `git push origin creator-corpus-20260827`; and
   - a bundle of that tag,
     `git bundle create creator-content-20260827.bundle creator-corpus-20260827`,
     stored wherever Muxin keeps offline backups. Bundle the tag, not the bare SHA: `git bundle`
     refuses a revision that names no ref ("Refusing to create empty bundle"), so the tag has to
     exist first. The bundle runs about 11 MB.
   The corpus already exists in `origin/main` history at `497d4ff`, so recovery is possible even
   without these. The tag and bundle make it possible without knowing that SHA.
2. **Relocate to a local, gitignored path**, mirroring the convention `data/patterns/**` already
   uses: copy the 62 files to a local directory, add the directory to `.gitignore`, and keep the
   index in git. The index is 13 KB of structured metadata with no creator body in it, so it can
   stay tracked and keep pointing at the local copy.
3. **Remove the tracked files in their own PR.** `git rm` the 62 files, keep the index, keep this
   staging package, and cite the tag and bundle from step 1 in the PR body. Reversible with a
   single `git revert`.
4. **Update the pointers.** `creator-content-index.md` and
   `corpus-ui-reconciliation-20260827.md` both describe the files as tracked. Both need a line
   saying where the raw copy now lives and that it is deliberately not in git.

**Do not rewrite history by default.** Purging the blobs from `origin/main` with a filter rewrite
is a separate and much heavier decision: it invalidates every existing clone, worktree and open
PR, and it is only worth doing if the goal is that the creator bodies never existed in the
repository at all rather than that they no longer ship with a checkout. The measured saving is
6,750,015 bytes of pack. Recommend against unless Muxin specifically wants the history purge, and
if she does, treat it as its own change with its own coordination.

## 5. Until the decision is made

Per `corpus-ui-reconciliation-20260827.md`: workers outside the corpus lane must not read the raw
creator-content files, and no prompt, UI or generator may load them. That rule stands whether or
not the files move.
