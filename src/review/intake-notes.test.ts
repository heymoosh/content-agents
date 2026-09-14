import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyzeNotes, confirmNotes, INTAKE_NOTE_FIELDS, notesPrompt, parseNotesAnalysis, readNotes, saveNotes } from './intake-notes.js';

const notes = 'I help civic organizers build tools. I have no customer evidence yet. I prefer plain writing and refuse hype. Three initial posts are sustainable.';
function reply() {
  return { summary: 'A civic tools venture, with demand still unproven.',
    fields: INTAKE_NOTE_FIELDS.map(f => ({ key: f.key, text: f.key === 'scorecard.required_live_posts' ? '3' : 'Context to review', basis: 'inferred', evidence: ['I help civic organizers build tools.'] })),
    questions: [] as { question: string; fields: string[] }[],
  };
}
function analyst(data = reply()) { return { name: 'fixture', analyze: async () => ({ text: JSON.stringify(data), engine: 'fixture', costUsd: 0 }) }; }

test('maps multiple context fields from notes, labels inference, and preserves manual answers', () => {
  const root = mkdtempSync(join(tmpdir(), 'intake-notes-'));
  try {
    const s = saveNotes('example', 0, notes, { q3: 'My correction' }, root);
    const raw = reply();
    raw.questions = [{ question: 'Who do you help?', fields: ['q2'] }];
    const parsed = parseNotesAnalysis(JSON.stringify(raw), s, { q1: 'My original manual answer' }, 'codex');
    assert.equal(parsed.fields.find(f => f.key === 'q1')?.text, 'My original manual answer');
    assert.equal(parsed.fields.find(f => f.key === 'q3')?.text, 'My correction');
    assert.equal(parsed.fields.find(f => f.key === 'q2')?.basis, 'inferred');
    assert.deepEqual(parsed.questions, [], 'do not ask already answered questions');
    const prompt = notesPrompt(s, {});
    assert.ok(prompt.includes(notes));
    assert.match(prompt, /Never invent proof/);
    assert.match(prompt, /at most three/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('unsupported evidence remains a gap; stale writes and incomplete model maps are refused', () => {
  const root = mkdtempSync(join(tmpdir(), 'intake-notes-'));
  try {
    const s = saveNotes('example', 0, notes, {}, root);
    const raw = reply(); raw.fields[0].evidence = ['invented customer result'];
    const parsed = parseNotesAnalysis(JSON.stringify(raw), s, {}, 'codex');
    assert.equal(parsed.fields[0].basis, 'missing'); assert.equal(parsed.fields[0].text, '');
    assert.deepEqual(parsed.questions[0].fields, ['q1']);
    raw.fields.pop();
    assert.throws(() => parseNotesAnalysis(JSON.stringify(raw), s, {}, 'codex'), /incomplete context map/);
    assert.throws(() => saveNotes('example', 0, 'overwrite', {}, root), /changed in another tab/);
    assert.equal(readNotes('example', root).notes, notes);
    assert.throws(() => saveNotes('../escape', 0, notes, {}, root), /bad venture slug/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('conflicting earlier answers remain available as evidence but require clarification', () => {
  const root = mkdtempSync(join(tmpdir(), 'intake-notes-'));
  try {
    const s = saveNotes('example', 0, notes, {}, root);
    const raw = reply(); raw.fields[0].basis = 'unclear'; raw.fields[0].text = '';
    raw.questions = [{ question: 'Which audience should we focus on now?', fields: ['q1'] }];
    const parsed = parseNotesAnalysis(JSON.stringify(raw), s, { q1: 'An earlier audience' }, 'codex');
    assert.equal(parsed.fields[0].basis, 'unclear');
    assert.equal(parsed.fields[0].text, '');
    assert.deepEqual(parsed.questions, raw.questions);
    const corrected = { ...s, corrections: { q1: 'My current choice' } };
    assert.equal(parseNotesAnalysis(JSON.stringify(raw), corrected, { q1: 'An earlier audience' }, 'codex').fields[0].text, 'My current choice');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('late model completion never overwrites newer notes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'intake-notes-'));
  try {
    const s = saveNotes('example', 0, notes, {}, root);
    const provider = { ...analyst(), analyze: async () => {
      saveNotes('example', s.revision, `${notes}\nA new detail.`, {}, root);
      return { text: JSON.stringify(reply()), costUsd: 0, engine: 'fixture' };
    } };
    await assert.rejects(analyzeNotes('example', s.revision, 'codex', { root, legacy: {}, analyst: provider }), /changed in another tab/);
    assert.equal(readNotes('example', root).analysis, null);
    assert.match(readNotes('example', root).notes, /new detail/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('confirmation alone creates a venture and preserves original notes and inference provenance', async () => {
  const root = mkdtempSync(join(tmpdir(), 'intake-notes-'));
  const before = process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT;
  process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT = join(root, 'ventures');
  try {
    const s = saveNotes('notes-confirm-fixture', 0, notes, {}, root);
    const analyzed = await analyzeNotes('notes-confirm-fixture', s.revision, 'codex', { root, legacy: {}, analyst: analyst() });
    const dir = join(root, 'ventures', 'notes-confirm-fixture');
    assert.equal(existsSync(dir), false, 'analysis never kicks off a venture');
    assert.throws(() => confirmNotes('notes-confirm-fixture', s.revision, root), /review the understanding/);
    const result = confirmNotes('notes-confirm-fixture', analyzed.revision, root);
    assert.equal(result.alreadyKickedOff, false);
    assert.match(readFileSync(join(dir, 'intake.md'), 'utf8'), /reviewed interpretations, not verbatim quotations/);
    const provenance = JSON.parse(readFileSync(join(dir, 'intake-context.json'), 'utf8'));
    assert.equal(provenance.notes, notes);
    assert.equal(provenance.reviewedBy, 'muxin');
    assert.equal(provenance.analysis.fields[0].basis, 'inferred');
    assert.throws(() => confirmNotes('notes-confirm-fixture', analyzed.revision, root), /already exists/);
  } finally {
    if (before === undefined) delete process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT; else process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT = before;
    rmSync(root, { recursive: true, force: true });
  }
});

test('new notes invalidate an older analysis and preserve the original wording', async () => {
  const root = mkdtempSync(join(tmpdir(), 'intake-notes-'));
  try {
    const s = saveNotes('example', 0, notes, {}, root);
    const analyzed = await analyzeNotes('example', s.revision, 'claude', { root, legacy: {}, analyst: analyst() });
    const changed = saveNotes('example', analyzed.revision, notes + '\nMore context.', {}, root);
    assert.equal(changed.analysis, null);
    assert.deepEqual(changed.history, [notes]);
    await assert.rejects(analyzeNotes('example', changed.revision, 'claude', { root, legacy: {}, analyst: { ...analyst(), analyze: async () => { throw new Error('provider unavailable'); } } }), /provider unavailable/);
    assert.equal(readNotes('example', root).notes, changed.notes);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
