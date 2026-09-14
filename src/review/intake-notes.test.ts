import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyzeNotes, confirmNotes, INTAKE_NOTE_FIELDS, notesPrompt, parseNotesAnalysis, readNotes, saveNotes, submitInterviewReply } from './intake-notes.js';
import { intakeProgress } from './intake-progress.js';

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
    assert.match(prompt, /at most one/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('chat saves a draft, preserves failed turns for retry, and maps a natural reply across fields', async () => {
  const root = mkdtempSync(join(tmpdir(), 'intake-chat-'));
  try {
    let state = saveNotes('chat-example', 0, notes, {}, root, 'I am unsure. What would you suggest?');
    assert.equal(readNotes('chat-example', root).draft, 'I am unsure. What would you suggest?');
    state = submitInterviewReply('chat-example', state.revision, root);
    assert.equal(state.draft, '');
    assert.equal(state.messages?.length, 1);
    const failure = { ...analyst(), analyze: async () => { throw new Error('offline'); } };
    await assert.rejects(analyzeNotes('chat-example', state.revision, 'codex', { root, legacy: {}, analyst: failure }), /offline/);
    state = submitInterviewReply('chat-example', state.revision, root);
    assert.equal(state.messages?.length, 1, 'retry never duplicates the saved user reply');
    const suggested = { ...reply(), reply: 'One possibility is a short checklist. Would you like to test that?' };
    state = await analyzeNotes('chat-example', state.revision, 'codex', { root, legacy: {}, analyst: analyst(suggested) });
    assert.match(state.messages?.[1].text ?? '', /ready for closeout review/);
    state = saveNotes('chat-example', state.revision, notes, {}, root, 'Yes, test that checklist. I can spend four hours weekly.');
    state = submitInterviewReply('chat-example', state.revision, root);
    const mapped = reply();
    mapped.fields[0] = { key: 'q1', text: 'Test a short checklist', basis: 'inferred', evidence: ['Yes, test that checklist.'] };
    mapped.fields[1] = { key: 'q2', text: 'Four hours weekly', basis: 'stated', evidence: ['I can spend four hours weekly.'] };
    const provider = { ...analyst(mapped), analyze: async (input: { prompt: string }) => {
      assert.match(input.prompt, /PREVIOUS WORKING CONTEXT/);
      assert.match(input.prompt, /Yes, test that checklist/);
      assert.match(input.prompt, /unaccepted assistant suggestion/);
      return { text: JSON.stringify(mapped), engine: 'fixture', costUsd: 0 };
    } };
    state = await analyzeNotes('chat-example', state.revision, 'codex', { root, legacy: {}, analyst: provider });
    assert.equal(state.analysis?.fields[0].text, 'Test a short checklist');
    assert.equal(state.analysis?.fields[1].text, 'Four hours weekly');
    assert.equal(readNotes('chat-example', root).messages?.length, 4);
    assert.equal(state.notes, notes, 'original notes remain unchanged');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a premature completion response cannot hide missing or invalid context', () => {
  const state = { revision: 0, notes, corrections: {}, history: [], analysis: null, legacy: {}, legacyHash: '' };
  const raw = { ...reply(), reply: 'We are done. No further interview question is needed.' };
  raw.fields[0].evidence = ['unsupported proof'];
  raw.fields.find(f => f.key === 'scorecard.required_live_posts')!.text = 'several';
  const parsed = parseNotesAnalysis(JSON.stringify(raw), state, {}, 'fixture');
  assert.doesNotMatch(parsed.reply!, /We are done|No further interview/);
  assert.match(parsed.reply!, /2 context details/);
  assert.ok(parsed.reply!.includes(parsed.questions[0].question));
  const progress = intakeProgress(INTAKE_NOTE_FIELDS, Object.fromEntries(parsed.fields.map(f => [f.key, f.text])));
  assert.equal(progress.ready, false);
  assert.deepEqual(progress.missing.map(f => f.key), ['q1', 'scorecard.required_live_posts']);
});

test('working answers survive submit/retry and unchanged answers reuse founder evidence, not model inventions', async () => {
  const root = mkdtempSync(join(tmpdir(), 'intake-memory-'));
  try {
    let state = saveNotes('memory', 0, notes, {}, root);
    const initial = reply(); initial.fields[1] = { key: 'q2', text: '', basis: 'missing', evidence: [] };
    state = await analyzeNotes('memory', state.revision, 'codex', { root, legacy: {}, analyst: analyst(initial) });
    state = saveNotes('memory', state.revision, notes, {}, root, 'Local civic organizers first.');
    state = submitInterviewReply('memory', state.revision, root);
    assert.equal(state.analysis, null);
    assert.equal(state.workingAnalysis?.fields[0].text, 'Context to review');
    assert.match(notesPrompt(state, {}), /PREVIOUS WORKING CONTEXT.*Context to review/);
    const raw = { ...reply(), fields: INTAKE_NOTE_FIELDS.map(f => f.key === 'q2'
      ? { key: f.key, text: 'Local civic organizers', basis: 'stated', evidence: ['Local civic organizers first.'] }
      : { key: f.key, basis: 'unchanged' }) };
    state = await analyzeNotes('memory', state.revision, 'codex', { root, legacy: {}, analyst: { ...analyst(), analyze: async () => ({ text: JSON.stringify(raw), costUsd: 0, engine: 'fixture' }) } });
    assert.equal(state.analysis?.fields[0].text, 'Context to review');
    assert.equal(state.analysis?.fields[1].text, 'Local civic organizers');
    assert.deepEqual(state.analysis?.questions, []);
    assert.match(state.analysis?.reply ?? '', /Start venture/);
    assert.equal(readNotes('memory', root).messages?.length, 3);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('explicit unknowns are valid founder context, while invalid post counts cannot pass closeout', async () => {
  const root = mkdtempSync(join(tmpdir(), 'intake-closeout-'));
  try {
    let state = saveNotes('closeout', 0, notes + ' I do not know the paid offer yet.', {}, root);
    const raw = reply();
    raw.fields.find(f => f.key === 'q21')!.text = 'Paid offer is not yet known.';
    raw.fields.find(f => f.key === 'q21')!.evidence = ['I do not know the paid offer yet.'];
    raw.fields.find(f => f.key === 'scorecard.required_live_posts')!.text = '0';
    state = await analyzeNotes('closeout', state.revision, 'codex', { root, legacy: {}, analyst: analyst(raw) });
    assert.equal(state.analysis?.fields.find(f => f.key === 'q21')?.text, 'Paid offer is not yet known.');
    assert.deepEqual(state.analysis?.questions[0].fields, ['scorecard.required_live_posts']);
    assert.throws(() => confirmNotes('closeout', state.revision, root), /Number of initial posts/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('assistant proposals cannot be evidence and unsubmitted replies block finalization', async () => {
  const root = mkdtempSync(join(tmpdir(), 'intake-chat-'));
  try {
    let state = saveNotes('chat-example', 0, notes, {}, root);
    state.messages = [{ role: 'assistant', text: 'You could aim for fifty signups.' }];
    const raw = reply(); raw.fields[0].evidence = ['fifty signups'];
    const parsed = parseNotesAnalysis(JSON.stringify(raw), state, {}, 'fixture');
    assert.equal(parsed.fields[0].text, '');
    const prompt = notesPrompt(state, {});
    assert.match(prompt, /offer two or three concrete/);
    assert.match(prompt, /Never tell the founder to fill out/);
    state = await analyzeNotes('chat-example', state.revision, 'codex', { root, legacy: {}, analyst: analyst() });
    state = saveNotes('chat-example', state.revision, notes, {}, root, 'Wait, I want to change something.');
    assert.throws(() => confirmNotes('chat-example', state.revision, root), /review the understanding/);
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
    const revised = { ...s, messages: [{ role: 'user' as const, text: 'Change my audience to local organizers.' }] };
    raw.fields[0] = { key: 'q1', text: 'Local organizers', basis: 'inferred', evidence: ['Change my audience to local organizers.'] };
    assert.equal(parseNotesAnalysis(JSON.stringify(raw), revised, { q1: 'An earlier audience' }, 'codex').fields[0].text, 'Local organizers');
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
