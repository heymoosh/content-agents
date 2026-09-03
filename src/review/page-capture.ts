export type CaptureRoom = "Content" | "Fiction" | "Outreach" | "Venture" | "Charles";
export type CaptureVerdict = { kind: "empty" } | { kind: "ask-link"; url: string } | { kind: "room"; room: CaptureRoom };

const BARE_URL_RE = /^\s*(https?:\/\/|www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|ai|org|io|net|co|dev)(\/\S*)?\s*$/i;

export function classifyCapture(text: string): CaptureVerdict {
  const t = String(text ?? "").trim();
  if (!t) return { kind: "empty" };
  const low = t.toLowerCase();
  if (/\bcharles\b|\bfeatherbottom\b/.test(low)) return { kind: "room", room: "Charles" };
  if (/follow up|reply to|email|intro|reach out|met /.test(low)) return { kind: "room", room: "Outreach" };
  if (/chapter|scene|elias|character|plot/.test(low)) return { kind: "room", room: "Fiction" };
  if (/price|offer|landing|magnet|survey|venture|phase|response|repl/.test(low)) return { kind: "room", room: "Venture" };
  if (BARE_URL_RE.test(t)) return { kind: "ask-link", url: t };
  return { kind: "room", room: "Content" };
}

export interface CaptureVerdictView { room: CaptureRoom; line: string; actionLabel: string | null; }

export function captureVerdict(room: CaptureRoom): CaptureVerdictView {
  if (room === "Content") return { room, line: "I read this as Content. Start on it opens an advisor round. Approval and publishing stay separate.", actionLabel: "Start on it" };
  if (room === "Fiction") return { room, line: "I read this as Fiction. Start on it puts these beats in Write next for you to review before drafting.", actionLabel: "Start on it" };
  if (room === "Outreach") return { room, line: "I read this as Outreach. Start on it opens the lead chooser; you still choose the person before any draft.", actionLabel: "Start on it" };
  if (room === "Venture") return { room, line: "I read this as Venture. Start on it opens the current human-gated venture step. It does not run or approve it.", actionLabel: "Start on it" };
  if (room === "Charles") return { room, line: "I read this as Charles. Start on it places the exact idea in Charles Input for you to review before drafting.", actionLabel: "Start on it" };
  throw new Error(`Unsupported capture room: ${String(room)}`);
}

export type DeskRoom = "content" | "studio" | "outreach" | "fiction" | "charles" | "venture" | "signals";
export const BOOT_ROOM: DeskRoom = "studio";
export const CAPTURE_RAIL_IDLE = "One place to say it";
export const CAPTURE_RAIL_ASKING = "A link is two things · you say which";
export const LINK_ASK_HEADING = "Where should this go?";
export const LINK_ASK_EXPLAINER = "Filing treats it as somewhere your readers came from. Reading treats it as source material for a post of yours. I will not guess between those two.";
export const LINK_ASK_SIGNALS_NOTE = "Source for Signals files a backlog card carrying the link. Nothing here records where a reader came from, so this is a note to look at it later, not attribution.";
