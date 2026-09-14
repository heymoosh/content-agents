// Read room-owned state without advancing work or interpreting approval on the owner's behalf.
import type { NeedsYouItem } from './studio.js';
import { listFictionSeries, readSceneBeats, readFictionChapter } from './fiction.js';
import { listIdeas } from '../fiction/idea-inbox.js';
import { BRAND_IDS, BRAND_REGISTRY } from '../identity/brand.js';
import { readSignals } from './signals.js';
import { readSignalsDecisions, recommendationKey } from './signals-decisions.js';
import { readSignalsProposals } from './signals-change-proposals.js';
import { readExperimentPlans } from './signals-experiment-plan-store.js';
import { readExperimentInterpretations } from './signals-experiment-result-store.js';
import { readSignalsVentureProposals } from './signals-venture-handoff-store.js';

const fictionReaders = { listFictionSeries, readFictionChapter,
  readSceneBeats: (slug: string) => readSceneBeats(slug, undefined, true),
  listIdeas: (slug: string) => listIdeas(slug, undefined, true),
};
const signalsReaders = { readSignals, readSignalsDecisions, readSignalsProposals, readExperimentPlans, readExperimentInterpretations, readSignalsVentureProposals };
function unavailable(room: 'fiction' | 'signals', detail: string, extra: Partial<NeedsYouItem> = {}): NeedsYouItem {
  return { room, label: room === 'fiction' ? 'Fiction' : 'Signals', text: 'Pending work could not be checked.', detail, action: 'Open', urgent: true, ...extra };
}

export function fictionNeedsYou(readers = fictionReaders): NeedsYouItem[] {
  const result: NeedsYouItem[] = [];
  let series;
  try { series = readers.listFictionSeries(); }
  catch { return [unavailable('fiction', 'Series list unavailable. Open Fiction to retry.')]; }
  for (const s of series) {
    const nav = { series: s.slug };
    try {
      const pending = readers.listIdeas(s.slug).filter(i => i.status === 'needs-review');
      if (pending.length) result.push({ room: 'fiction', label: 'Fiction', text: `${pending.length} idea${pending.length === 1 ? '' : 's'} need your review or clarification.`, detail: s.title, action: 'Review ideas', urgent: false, ...nav, page: 'inbox' });
    } catch { result.push(unavailable('fiction', `${s.title}: idea inbox unavailable.`, { ...nav, page: 'inbox' })); }
    try {
      // Only the Studio-owned scene is reviewable here. /story chapters retain their GitHub review flow.
      const beats = readers.readSceneBeats(s.slug);
      if (beats?.chapter) {
        const chapter = readers.readFictionChapter(s.slug, beats.chapter);
        if (['drafting', 'draft', 'pending', 'review', 'needs-review'].includes(chapter.status)) result.push({ room: 'fiction', label: 'Fiction', text: 'A scene is ready for your review.', detail: `${s.title} · Chapter ${chapter.number}`, action: 'Review scene', urgent: false, ...nav, page: 'review' });
      }
    } catch { result.push(unavailable('fiction', `${s.title}: scene review state unavailable.`, { ...nav, page: 'review' })); }
  }
  return result;
}

export function signalsNeedsYou(readers = signalsReaders): NeedsYouItem[] {
  const result: NeedsYouItem[] = [];
  // Each store fails independently: an unavailable result ledger must not hide plan decisions.
  for (const brand of BRAND_IDS) {
    const counts: string[] = [];
    const failed: string[] = [];
    const count = (label: string, read: () => number) => {
      try { const n = read(); if (n) counts.push(`${n} ${label}`); } catch { failed.push(label); }
    };
    count('recommendations', () => {
      const decisions = readers.readSignalsDecisions();
      return readers.readSignals(brand).recommendations.filter(r => !decisions[recommendationKey(r.type, r.title, brand)]).length;
    });
    count('configuration reviews', () => readers.readSignalsProposals().filter(p => p.brandId === brand && p.status === 'pending').length);
    count('experiment plans', () => readers.readExperimentPlans().filter(p => p.brandId === brand && p.status === 'proposed').length);
    count('experiment conclusions', () => readers.readExperimentInterpretations().filter(p => p.brandId === brand && p.reviewStatus === 'pending').length);
    if (counts.length) result.push({ room: 'signals', label: 'Signals', text: `${BRAND_REGISTRY[brand].label} decisions need you.`, detail: counts.join(' · '), action: 'Review', urgent: false, brand });
    if (failed.length) result.push(unavailable('signals', `${BRAND_REGISTRY[brand].label}: ${failed.join(', ')} unavailable.`, { brand }));
  }
  try {
    const n = readers.readSignalsVentureProposals().filter(p => p.status === 'pending').length;
    if (n) result.push({ room: 'signals', label: 'Signals', text: `${n} Venture handoff${n === 1 ? '' : 's'} need your decision.`, detail: 'Review before sending to Venture.', action: 'Review', urgent: false, brand: 'human-inference' });
  } catch { result.push(unavailable('signals', 'Venture handoff decisions unavailable.', { brand: 'human-inference' })); }
  return result;
}
