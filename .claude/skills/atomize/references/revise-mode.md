# /atomize --revise — revision mode

`/atomize --revise <folder>`: read `review-queue.md`, find rows with status `revise`, and act
by `format`:
- **Text derivatives / quote cards**: re-draft ONLY those using the `notes` column as
  instruction (extraction-first still applies), re-validate.
Reset revised rows to `pending`, re-validate, and report. (storyboard / short rows are revised
with `/video --revise <folder>`.)
