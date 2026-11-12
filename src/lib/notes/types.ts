/**
 * Notes: a visual study board per lesson. Plain data shapes shared by the board UI, the sync engine, the outline
 * and the tests. A board belongs to ONE lesson; only its owner can read or change it (RLS).
 */
export type CardType = "note" | "sticky" | "quote" | "image" | "drawing" | "link" | "checklist" | "frame";
export const CARD_TYPES: CardType[] = ["note", "sticky", "quote", "image", "drawing", "link", "checklist", "frame"];

/** Soft card colours (light theme). */
export const CARD_COLORS = ["white", "yellow", "green", "blue", "pink", "orange"] as const;
export type CardColor = (typeof CARD_COLORS)[number];

export type ChecklistItem = { id: string; text: string; done: boolean };

/** Everything a card shows; which fields are used depends on the type. */
export type CardData = {
  title?: string;
  /** Markdown-ish rich text: headings, **bold**, lists, - [ ] checklists, ==highlight==, links, $math$. */
  body?: string;
  color?: CardColor;
  /** quote: the lesson + part it came from. */
  quote?: { text: string; lessonId: string; href: string; part?: number; lessonLabel?: string };
  /** image: path in the private note-images bucket (or a local data URL when logged out). */
  image?: { path?: string; local?: string; w: number; h: number; alt?: string };
  /** drawing: vector ink (src/lib/ink/model.ts InkDoc). */
  drawing?: unknown;
  link?: { url: string; title?: string };
  items?: ChecklistItem[];
  /** this card is a flashcard (front/back). */
  flashcard?: boolean;
};

export type BoardNode = {
  id: string;
  type: CardType;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  /** frame that groups this card (moving the frame moves its cards) */
  parent?: string | null;
  data: CardData;
  updated_at: string;
};

export type EdgeStyle = { color?: string; dashed?: boolean };
export type BoardEdge = { id: string; source: string; target: string; label?: string; style?: EdgeStyle; updated_at: string };

export type Viewport = { x: number; y: number; zoom: number };
export type Board = {
  id: string;
  lesson_id: string;
  subject_id?: string | null;
  title: string;
  /** Icon key (components/notes/board-icon.tsx), stored in the old "emoji" column. Never an emoji. */
  emoji: string;
  colour: string;
  template: string;
  viewport?: Viewport | null;
  created_at: string;
  updated_at: string;
  last_opened_at?: string | null;
  deleted_at?: string | null;
  /** only on this device (logged out, or not uploaded yet) */
  local?: boolean;
};

export type BoardState = { board: Board; nodes: BoardNode[]; edges: BoardEdge[] };

/** Default size per card type (the UI can resize). */
export const CARD_SIZE: Record<CardType, { w: number; h: number }> = {
  note: { w: 260, h: 170 },
  sticky: { w: 190, h: 170 },
  quote: { w: 280, h: 150 },
  image: { w: 260, h: 200 },
  drawing: { w: 300, h: 220 },
  link: { w: 240, h: 96 },
  checklist: { w: 240, h: 180 },
  frame: { w: 520, h: 360 },
};

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));

export const now = () => new Date().toISOString();

/** Plain text of a card (search, outline, export, AI). */
export function cardText(n: BoardNode): string {
  const d = n.data;
  const parts = [d.title, d.body, d.quote?.text, d.link?.title, d.link?.url, ...(d.items ?? []).map((i) => `${i.done ? "[x]" : "[ ]"} ${i.text}`)];
  return parts.filter(Boolean).join("\n").trim();
}
