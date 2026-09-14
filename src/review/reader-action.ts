import { z } from 'zod';
import { safeDestinationUrl } from '../venture/conversions.js';

export const readerActionSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('none') }),
  z.object({ mode: z.literal('source') }),
  z.object({ mode: z.literal('destination'), destinationId: z.string().min(1), ventureId: z.string().min(1),
    url: z.string().refine(safeDestinationUrl), label: z.string().trim().min(1).max(2000),
    reason: z.string().trim().min(1).max(4000), measurement: z.string().max(2000),
    from: z.enum(['venture', 'advisor', 'owner']), reviewed: z.literal(true),
  }),
]);
export type ReaderAction = z.infer<typeof readerActionSchema>;
export function readerActionFrontmatter(action: ReaderAction | null | undefined): string[] {
  if (!action) return [];
  if (action.mode !== 'destination') return [`cta: ${action.mode}`];
  return [`cta: ${JSON.stringify(action.url)}`, `cta_label: ${JSON.stringify(action.label)}`,
    `cta_id: ${JSON.stringify(action.destinationId)}`, `cta_venture_id: ${JSON.stringify(action.ventureId)}`,
    `cta_reason: ${JSON.stringify(action.reason)}`, `cta_measurement: ${JSON.stringify(action.measurement)}`,
    `cta_origin: ${action.from}`, 'cta_reviewed: true', 'cta_fit: high', 'cta_value: high'];
}
