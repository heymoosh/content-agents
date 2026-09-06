# SLICE-5L coverage proof — what the Content room actually handles

Built 2026-09-06 by tracing the Content room's code from its live entry points to a
`review-queue.md` row. Nothing here was inferred from a UI label, a route allowlist, a
dependency marked closed, or a SKILL.md's description of itself.

`/cycle` step 3 today reads:

> Ask Muxin if there's new content to atomize (**Substack URL, file, or voice memo**) … For each,
> run the `/atomize` skill flow (text + quote cards). … **Video is separate:** for any piece worth
> a short, offer to run `/video <folder>`.

The question this document answers is narrow: for each input kind that sentence accepts, can a
person sitting in the Content room get that input to a `review-queue.md` row without `/cycle`?

## The two chains the room actually has

Everything below is one of these two, so they are traced once here and referenced per row. Chain A
reaches a queue row. Chain B is wired but cannot succeed — see its step 6.

### Chain A — Studio capture → advisor → accepted cut → configured generation

1. `src/review/page.ts:1076` — the capture control is a `<textarea id="src">`. There is no file
   picker and no upload; a file is named by typing its path.
2. `src/review/page.ts:1083` + `:7000` — "Start on it" (`#routeBtn`) calls `routeCapture()`
   (`page.ts:6957`).
   **The capture is room-classified here, and Content is not the default.** `classifyCapture`
   (`page.ts:6777-6787`) tests other-room keywords **first** — Charles, Outreach, Fiction, Venture
   at `page.ts:6781-6784` — and only falls through to `{room:"Content"}` at `page.ts:6786`.
   `routeCapture` then calls `POST /api/captures/classify` (`page.ts:6967`), whose model verdict
   overrides the keyword guess (`page.ts:6969-6971`). So a file path or a pasted thought
   containing, say, "chapter" or "price" is routed away from Content. This does not remove the
   route: `showCaptureVerdict` renders "Wrong room?" buttons for every other room
   (`page.ts:6849-6850`), so Muxin can always land the capture in Content herself. It is a step
   the first revision of this chain omitted, not a missing path.
3. `src/review/page.ts:6903` `takeCaptureTo()` → `POST /api/captures` (`serve.ts:1446`) persists
   the capture, then `advanceCaptureSafely()` (`page.ts:6858`) posts `/api/captures/start` for
   Content (`page.ts:6861`). The same call is available later from the capture card's own
   "Start on it" (`page.ts:6941-6946`).
4. `src/review/serve.ts:1504-1509` — the Content branch runs
   `sourceDispatch(classifySource(capture.text), capture.text)` and hands the result to
   `addDevelopJob(dispatch.kind, …)`. **This is the dispatcher.** `classifySource`
   (`jobs.ts:1918-1940`) is the only thing that decides what an input is, and `sourceDispatch`
   (`jobs.ts:1945-1956`) can only ever return `url`, `file` or `text` — `serve.ts:1507` explicitly
   throws for anything else.
5. `src/review/jobs.ts:2060-2081` `addDevelopJob` → a `develop` job whose arg is the URL, or, for
   `file`/`text`, a copy materialized into `content/.inbox/` by `materializeInboxArg`
   (`jobs.ts:1998-2013`).
6. `src/review/jobs.ts:2408-2412` → `runDevelopJob` (`jobs.ts:2186-2211`) spawns `/develop <arg>`
   and **verifies by artifact**: a new folder must appear in `listSlugs()` and carry a new
   parseable round in `develop/advice.json`, or the job fails (`jobs.ts:2205`). `listSlugs()`
   (`jobs.ts:1981-1989`) only counts a directory that has a `review-queue.md`.
7. `.claude/skills/develop/SKILL.md:29` — step 0 of the advisor runs `npm run new-content -- <arg>`
   for a URL or a file path. `scaffoldContentFolder` (`src/atomize/new-content.ts:117-155`) writes
   `source.md` and an empty-table `review-queue.md` (`:150-153`), which is what makes step 6's
   artifact check pass.
8. `src/review/develop.ts:385-424` `contentSessionForFolder` lists the folder in the Content
   workbench once it has an advisor round.
9. Muxin accepts an angle: `POST /api/develop/accept` (`serve.ts:1647`) → `acceptAngle` builds a
   cut from her own verbatim `source.md` lines. `page.ts:3311` sets `CW.approvedLens`.
10. `src/review/page.ts:3186` — the "Configure this approved cut" button renders **only** when
    `CW.approvedLens` is set. `page.ts:3345` also sets it when she selects an existing cut.
11. `src/review/page.ts:3263-3302` `cwSaveConfig()` → `POST /api/content/request`
    (`serve.ts:1562`) then `POST /api/content/generate` (`serve.ts:1580`).
12. `src/review/jobs.ts:1131` `generateConfiguredContent` → writes `derivatives/<id>.md`
    (`jobs.ts:1411`), a media stage, and finally `appendRows(folder, queueRows)`
    (`jobs.ts:1436`) with `status: "pending"` and `origin: "from GUI queue"` (`jobs.ts:1434`).

Step 12 is covered by passing tests that read the queue back off disk:
`src/review/content-generation.test.ts:84`, `:252`, `:659`.

### Chain B — Substack Notes → scaffold → `/atomize --continue`

1. `src/review/page.ts:1088` + `:7082` — "Pull Substack Notes" (`#notesBtn`) → `openNotes()`
   (`page.ts:7043`) → `GET /api/notes` (`serve.ts:1746`).
2. `serve.ts:1753` calls `fetchNotesList`, which writes `data/notes-cache.json`
   (`src/atomize/new-notes.ts:113`). That write is what the pick step later reads; without it
   `scaffoldPicked` throws (`new-notes.ts:149-151`).
3. `src/review/page.ts:7085` + `:7061` — "Draft selected" → `POST /api/notes/pick`
   (`serve.ts:1776`).
4. `serve.ts:1783` `scaffoldPicked(indices)` (`new-notes.ts:148-175`) → `scaffoldContentFolder`
   per picked note, `sourceKind: "substack-note"` — same folder + `review-queue.md` writer as
   Chain A step 7.
5. `serve.ts:1786` `addJob("continue", "--continue <dir>", …)` (`jobs.ts:2019-2027`).
6. `jobs.ts:2414-2418` → `runContinueJob` (`jobs.ts:2218-2243`) spawns the real
   `/atomize --continue <dir>` via `runAtomizeJob` (`jobs.ts:2149-2156`) and **verifies by
   artifact**: `continueArtifactCounts` (`jobs.ts:2120-2135`) reads `review-queue.md` row count
   and the derivatives directory before and after, and `continueJobProgressed`
   (`jobs.ts:2136-2138`) requires one of them to have grown, or the job fails (`jobs.ts:2234`).
   **Step 6 is where this chain breaks.** The spawn carries no `--brand` (defect 5), the inspected
   path is doubled so both counts are always zero (defect 6), and even a repaired chain would
   accept derivative growth with zero new rows. Chain B is written out here because it is wired,
   not because it works.

## Coverage table

| Input kind | Content-room entry point (file:line) | What it produces | Evidence class |
|---|---|---|---|
| **Substack essay URL** | Chain A. A bare link is intercepted first: `classifyCapture` returns `ask-link` (`page.ts:6785`), `openLinkAsk` (`page.ts:6822`) opens the two-button ask, and "Versions for Content" (`page.ts:1095`, `:7001`) → `linkReadForContent` (`page.ts:6982`) parks it in Content; its capture card's "Start on it" (`page.ts:6941-6946`) enters Chain A at step 4, where `classifySource` returns `url` (`jobs.ts:1923`) and the URL passes through unmaterialized (`jobs.ts:2075`) to `npm run new-content -- <url>` → `fetchSubstackPost` (`new-content.ts:70-72`). | `content/<slug>/` with `source.md`, an advisor round, an accepted cut, `derivatives/*.md`, and `pending` `review-queue.md` rows stamped `from GUI queue`. | **code-path** |
| **Local file (text / markdown)** | Chain A. `classifyCapture` falls through to `{room:"Content"}` (`page.ts:6786`); `classifySource` returns `file` for a single-line path under 400 chars that `existsSync` resolves (`jobs.ts:1926-1928`), including `~/` expansion (`jobs.ts:1924`). A path-shaped string that does not resolve returns `file-not-found` (`jobs.ts:1935-1937`) and `sourceDispatch` turns it into an immediate error instead of a job (`jobs.ts:1949-1951`). `materializeInboxArg` copies the file into `content/.inbox/` as UTF-8 markdown (`jobs.ts:2005-2012`). | Same as above. | **code-path** |
| **Voice memo (audio file)** | **None.** The room has no audio door and no transcription call: `grep` for `audio\|m4a\|mp3\|wav\|transcri` across `src/review/serve.ts` and `src/review/page.ts` returns no ingest path (the only hits are the `audiogram` media option, `page.ts:2970`, `:3017-3020`, `:3261`, which is *disabled* unless the folder's `sourceKind` already says audio — and only `new-content.ts:86` ever sets that). | Nothing. See "What happens today" below. | **unproven** |
| **Substack Notes** (`/atomize notes`) | Chain B is wired end to end, but it does not reach a queue row. Three independent breaks: (i) `runAtomizeJob` spawns `/atomize ${job.arg}` with no `--brand` (`jobs.ts:2150`; `enginePrompt` adds none, `engines.ts:85-94`), and `.claude/skills/atomize/SKILL.md:7-8` requires the skill to reject a missing brand with no fallback; (ii) `runContinueJob` inspects a path that cannot exist — `scaffoldContentFolder` returns an absolute path (`new-content.ts:125`), `serve.ts:1786` embeds it in `--continue <abs>`, and `jobs.ts:2220` does `join(repoRoot, parsed.folder)` on it (see defect 6 below); (iii) even if both were fixed, `continueJobProgressed` (`jobs.ts:2137`) accepts derivative growth **or** row growth, so a passing job still would not prove a row landed. | Nothing provable. | **unproven** |
| **The `/video` offer** | **The chain dead-ends at the UI.** It holds as far as the queue row: wizard media `short-video-script` (`page.ts:2969`) → `configuredMediaStage` returns `queue: { format: "storyboard" }` (`configured-media.ts:235-243`) → `appendRows` (`jobs.ts:1436`) → `enrich` sets `canGenerateStoryboard` (`rows.ts:189`, `:207`). It then stops: the only control that reads that flag and emits `data-act="gen-storyboard"` is at `page.ts:1534-1537`, inside `rowEl` (`page.ts:1466`), and **`rowEl` has no callers** — `grep -n rowEl src/review/page.ts` returns its definition plus one unrelated comment at `:2839`. The live row renderer is `reviewScanRowEl` (`page.ts:1595`, called at `page.ts:1807`), which renders "Open Focus Mode" (`page.ts:1601`) and no storyboard button. The click handler is dead too: `onAction` (`page.ts:1655`), which holds the `gen-storyboard` branch at `page.ts:1711`, is wired only from inside `rowEl` (`page.ts:1590`). So `POST /api/video/generate` (`serve.ts:1696`) has no reachable caller, and `addVideoJob`/`runVideoJob` (`jobs.ts:2032`, `:2161`) are never entered from the room. | A `storyboard` review row that Muxin cannot act on in the room. | **unproven** |
| **Pasted text** (not named in step 3, but `/atomize` accepts it) | Chain A with `classifySource` returning `text` (`jobs.ts:1938-1939`) and `materializeInboxArg` writing `content/.inbox/<jobid>.md` (`jobs.ts:2000-2003`). | Same as URL / file. | **code-path** |

## What happens to someone who tries a voice memo in the room today

Silent corruption, not an error, and not a no-op.

There is no file picker, so the only way to name a memo is to type its path into the capture box.
`classifySource` sees a single-line path that exists and returns `file` (`jobs.ts:1926-1928`) — it
does not look at the extension. `materializeInboxArg` then does
`readFileSync(rawArg, "utf8")` (`jobs.ts:2005`) on the M4A and writes the decoded bytes into
`content/.inbox/<name>-<id>.md` (`jobs.ts:2011`). `/develop` is handed that `.md` path, so when
`resolveSource` checks `AUDIO_EXTS.has(extname(arg))` (`new-content.ts:75-76`) the answer is no and
the transcription provider is never called (`new-content.ts:77-88`). The result is a real content
folder whose `source.md` body is mojibake, and an advisor round written about it.

The CLI path is unaffected: `npm run new-content -- memos/idea.m4a` still transcribes
(`new-content.ts:76-88`), which is what `/atomize` uses.

## Six things that are listed but not reached

Recorded, not fixed — this slice measures the room, it does not change it (packet "Do not touch").
Items 4-6 are live production defects found while proving the rows above; each deserves its own
slice.

1. **`POST /api/atomize` is unreachable from the UI.** The route exists (`serve.ts:1730-1745`) and
   is listed in `JOB_ENQUEUE_ROUTES` (`page.ts:6420`) and `studio-job-ui.ts:245`. Its only
   client-side caller is `addSource()` (`page.ts:6766`), and `addSource` is bound to nothing:
   `grep -rn addSource src/` returns exactly one hit, its own definition at `page.ts:6760`. Being
   in a route allowlist is not being dispatched to. This is why Chain A goes through
   `/api/captures/start` and the advisor, not through `/atomize`.
2. **"Format for platforms" has no caller.** `buildFormatArg` (`jobs.ts:2100-2102`), which builds
   the `--continue content/<slug>` arg, has no non-test caller anywhere in `src/`.
   `.claude/skills/develop/SKILL.md:11-12` still says "'Format for platforms' runs the normal
   `/atomize --continue` pipeline afterward"; for the GUI that is stale. The live replacement is
   `POST /api/content/generate` (Chain A steps 11-12). Chain B still uses `--continue` jobs, so
   `runContinueJob` itself is live.
3. **`AtomizeFamilyKind` includes `"notes"`, which nothing can produce.** `sourceDispatch` can only
   return `url`/`file`/`text` (`jobs.ts:1949-1955`), and the three `addJob` call sites pass
   `dispatch.kind` (`serve.ts:1742`), `"continue"` (`serve.ts:1786`) and `"video"`
   (`jobs.ts:2037`). The `"notes"` member of the union at `jobs.ts:1993` is dead.
4. **The whole review-row action surface in `rowEl` is dead code.** `rowEl` (`page.ts:1466`) has no
   callers — `grep -n rowEl src/review/page.ts` returns the definition and one unrelated comment at
   `:2839`. The live renderer is `reviewScanRowEl` (`page.ts:1595`, called at `page.ts:1807`). So
   the "Generate storyboard" button (`page.ts:1537`), the `onAction` dispatcher wired at
   `page.ts:1590`, and every branch inside it — `gen-storyboard` (`:1711`), `approve-media-plan`
   (`:1719`), `render-media` (`:1724`), `attach-reviewed-media` (`:1729`) — are unreachable from
   the room. This is what reclassified the `/video` row above to `unproven`. The blast radius is
   wider than video and was not measured here.
5. **The GUI's `/atomize` and `/video` spawns omit the required `--brand`.** `runAtomizeJob`
   builds `/atomize ${job.arg}` (`jobs.ts:2150`) and `runVideoJob` builds `/video ${job.arg}`
   (`jobs.ts:2163`); `enginePrompt` (`engines.ts:85-94`) prepends only skill-reading instructions
   and no arguments. Both skills require a canonical brand at entry and forbid a Human Inference
   fallback (`.claude/skills/atomize/SKILL.md:7-8`, `.claude/skills/video/SKILL.md:7-9`). Every
   Notes-pick job therefore dispatches a call the skill is obliged to refuse. `runDevelopJob`
   (`jobs.ts:2190`) has the same shape, but `/develop` declares no brand argument, so it is
   unaffected.
6. **`runContinueJob` inspects a path that cannot exist, so a successful Notes job reports
   failure.** `scaffoldContentFolder` returns an absolute path — `join(repoRoot, "content", …)`
   (`new-content.ts:125`). `serve.ts:1786` embeds it verbatim as `--continue ${r.dir}`, and
   `parseContinueArg` (`jobs.ts:2106-2110`) captures it with `\S+`, which an absolute slugified
   path satisfies. `runContinueJob` then does `join(repoRoot, parsed.folder)` (`jobs.ts:2220`).
   Node's `path.join` concatenates rather than discarding the prefix, verified directly:

   ```
   scaffold returns:            /…/content-agents/content/2026-09-06-a-note
   runContinueJob inspects:     /…/content-agents/Users/Muxin/…/content-agents/content/2026-09-06-a-note
   ```

   `continueArtifactCounts` (`jobs.ts:2120-2135`) swallows both `readQueue` and `readdirSync`
   failures and returns zeros, so `before` and `after` are both `{rows:0,derivatives:0}`,
   `continueJobProgressed` (`jobs.ts:2136-2138`) is false, and `jobs.ts:2234` marks the job
   `failed` with "formatting ran but added no new rows or derivatives" — even on a run that did
   exactly the right thing on disk. `stampFolderEngine` (`jobs.ts:2237`) sits in the unreachable
   `done` branch, so the engine stamp is silently never written either. This is a live bug in
   Muxin's Notes drafting flow, not a coverage artifact.

## Caveats that do not change a row's class, but are real

- **The room needs one more human step than `/cycle` did.** `/atomize` drafts derivatives straight
  from a source; the room requires an accepted cut before the Configure button exists at all
  (`page.ts:3186` gates on `CW.approvedLens`). If the advisor proposes nothing Muxin accepts, she
  reaches no drafts. `acceptAngle` additionally refuses a card with no `source_lines`
  (`develop.ts:186`), so a thin advisor round can stall the chain. That is the room model working
  as designed, not a missing input kind, but it means "retired" here means "`/cycle` stops asking",
  not "the two paths are identical". The gate applies to the three Chain A kinds — URL, file,
  pasted text — and **not** to picked Notes, which bypass the advisor entirely and dispatch
  straight to `/atomize --continue` (Chain B step 5).
- **Only one short-video variant per folder is permitted, and the wizard's defaults exceed it.**
  `buildConfiguredMediaOutputs` throws when more than one variant carries
  `media: "short-video-script"` (`jobs.ts:999-1002`), and it runs at `jobs.ts:1175`, before
  `runQueued` and before any write. But the request builder emits one control variant per
  platform per medium (`content-request.ts:296-301`) plus one treated variant per treatment
  (`:303-305`), and the wizard defaults `control:true` (`page.ts:3008`). So selecting
  `short-video-script` for two platforms, or for one platform with a treatment selected, already
  throws. The only configuration that passes is a single platform with that medium and either
  control-on with zero treatments, or control-off with exactly one treatment.
- **No scoring and no thread-check on the configured path.** `NewQueueRow`
  (`queue.ts:135-143`) has no native/brand score fields, and `grep` for `threadCheck` in
  `src/review/jobs.ts` returns nothing. The gates the configured path does run are
  `checkPlatformLimits`, `checkSkeletonGate` and `checkCaseGate` (`jobs.ts:1370-1383`).
  `/atomize`'s scoring soft gate and home-brand thread-check are not in the room.
- **No `routing.md` on a develop-created folder.** `generateConfiguredContent` reads `routing.md`
  if it exists and skips a platform the router vetoed (`jobs.ts:1140-1147`); with no file the map
  is empty and nothing is skipped. Platform choice is Muxin's explicit wizard selection instead.
- **`"from /cycle"` must stay in `QUEUE_ORIGINS`.** Two real folders on disk carry it —
  `content/2026-09-02-the-world-s-broken-what-do-we-do/review-queue.md:16-29` and
  `content/2026-07-10-human-inference-defining-a-brand-in-an-ai-drench/review-queue.md:22-33` —
  and `/atomize` still writes it as its default origin for a direct run
  (`.claude/skills/atomize/SKILL.md:513`). Retiring `/cycle`'s step 3 removes neither. `queue.ts`
  is not touched by this slice.

## Verdict

Retire step 3 for the three kinds proved to reach a queue row: **Substack essay URL, local text or
markdown file, and pasted text**.

Keep step 3 for:

- **Voice memos** — the room has no audio door, and its file door turns an M4A into mojibake
  rather than transcribing it.
- **The `/video` offer** — the room's storyboard control is in dead code (`page.ts:1466` vs the
  live `page.ts:1807`), so `/api/video/generate` has no reachable caller. Step 3 genuinely carried
  this offer, so removing it would have removed the only working path.

**Substack Notes are not a step-3 question.** Step 3 never offered them; `/atomize notes` is
invoked directly. Nothing is retired for them and nothing is restored. Their room path is
`unproven` and carries two live defects (5 and 6 above), so `/cycle` should make no claim about
where Notes are handled.

An earlier revision of this document retired Notes and the `/video` offer on `code-path` evidence.
Both were wrong, and both were caught by cross-family audit: the `/video` chain was traced through
a renderer nothing calls, and the Notes chain through a job that cannot succeed. The corrections
are recorded above rather than quietly rewritten, because the failure mode they illustrate — a
`file:line` citation standing in for a reached code path — is the one this slice existed to avoid.
