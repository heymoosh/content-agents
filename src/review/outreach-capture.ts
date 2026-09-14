import { CAPTURES_PATH, listCaptures, markCapturePromoted } from "./captures.js";
import { saveLeadDirection } from "../outreach/direction.js";
import { withFileLock } from "../runtime/file-lock.js";

/** Save the lead first, then retire the inbox item. A retry repairs an interrupted promotion. */
export function attachOutreachCapture(root: string, dir: string, captureId: string, path = CAPTURES_PATH) {
  return withFileLock(path + ".outreach.lock", () => {
    const capture = listCaptures(path).find(c => c.id === captureId && c.room === "Outreach");
    if (!capture) throw new Error("No such Outreach capture");
    if (capture.jobId || capture.startedAt) throw new Error("This capture has already started a job");
    if (capture.promotion && capture.promotion.itemId !== dir) throw new Error("This thought is already attached to another lead");
    const direction = saveLeadDirection(root, dir, capture.text, capture.id);
    markCapturePromoted(capture.id, { room: "Outreach", itemId: dir }, path);
    return direction;
  });
}
