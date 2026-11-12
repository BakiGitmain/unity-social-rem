"use client";

/**
 * Notes data in the browser: Supabase (own rows only, RLS) + an IndexedDB copy of every board (offline-first).
 * Logged out: boards live ONLY on this device (local: true) until the student logs in and uploads them.
 */
import { createClient } from "@/lib/supabase/client";
import { buildTemplate, type TemplateId } from "./templates.ts";
import { NEW_CARD, review, type Rating, type SrsState } from "./srs.ts";
import { EMPTY_PENDING, type Pending, type SyncApi } from "./sync.ts";
import { boundsOf, freeSpot } from "./layout.ts";
import { now, uid, type Board, type BoardEdge, type BoardNode, type BoardState } from "./types.ts";

/* ------------------------------------------------------------------ IndexedDB */

const DB = "usr-notes";
const STORES = ["boards", "pending", "flash"] as const;
type Store = (typeof STORES)[number];
let dbp: Promise<IDBDatabase | null> | null = null;
const memory = new Map<string, unknown>();

function open(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => STORES.forEach((s) => req.result.objectStoreNames.contains(s) || req.result.createObjectStore(s));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbp;
}
export async function idb<T>(store: Store, key: string, value?: T | null): Promise<T | undefined> {
  const db = await open();
  if (!db) {
    if (value === undefined) return memory.get(`${store}:${key}`) as T | undefined;
    if (value === null) memory.delete(`${store}:${key}`);
    else memory.set(`${store}:${key}`, value);
    return value ?? undefined;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, value === undefined ? "readonly" : "readwrite");
      const os = tx.objectStore(store);
      if (value === undefined) {
        const r = os.get(key);
        r.onsuccess = () => resolve(r.result as T | undefined);
        r.onerror = () => resolve(undefined);
      } else {
        if (value === null) os.delete(key);
        else os.put(value, key);
        tx.oncomplete = () => resolve(value ?? undefined);
        tx.onerror = () => resolve(undefined);
      }
    } catch {
      resolve(undefined);
    }
  });
}
async function idbAll<T>(store: Store): Promise<T[]> {
  const db = await open();
  if (!db) return [...memory.entries()].filter(([k]) => k.startsWith(`${store}:`)).map(([, v]) => v as T);
  return new Promise((resolve) => {
    try {
      const r = db.transaction(store).objectStore(store).getAll();
      r.onsuccess = () => resolve(r.result as T[]);
      r.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export const cacheBoard = (s: BoardState) => idb<BoardState>("boards", s.board.id, s);
export const cachedBoard = (id: string) => idb<BoardState>("boards", id);
export const savePending = (id: string, p: Pending | null) => idb<Pending>("pending", id, p);
export const loadPending = async (id: string) => (await idb<Pending>("pending", id)) ?? EMPTY_PENDING;

/* ------------------------------------------------------------------ rows ⇄ objects */

type NodeRow = { id: string; board_id: string; type: BoardNode["type"]; x: number; y: number; w: number; h: number; z_index: number; parent_id: string | null; data: BoardNode["data"]; updated_at: string };
type EdgeRow = { id: string; board_id: string; source: string; target: string; label: string | null; style: BoardEdge["style"]; updated_at: string };
const toNode = (r: NodeRow): BoardNode => ({ id: r.id, type: r.type, x: r.x, y: r.y, w: r.w, h: r.h, z: r.z_index, parent: r.parent_id, data: r.data ?? {}, updated_at: r.updated_at });
const toEdge = (r: EdgeRow): BoardEdge => ({ id: r.id, source: r.source, target: r.target, label: r.label ?? undefined, style: r.style ?? {}, updated_at: r.updated_at });
const nodeRow = (boardId: string, n: BoardNode) => ({ id: n.id, board_id: boardId, type: n.type, x: n.x, y: n.y, w: n.w, h: n.h, z_index: n.z, parent_id: n.parent ?? null, data: n.data, updated_at: n.updated_at });
const edgeRow = (boardId: string, e: BoardEdge) => ({ id: e.id, board_id: boardId, source: e.source, target: e.target, label: e.label ?? null, style: e.style ?? {}, updated_at: e.updated_at });
const BOARD_COLS = "id, lesson_id, subject_id, title, emoji, colour, template, viewport, created_at, updated_at, last_opened_at, deleted_at";

/* ------------------------------------------------------------------ server API (Supabase, RLS) */

export function serverApi(boardId: string): SyncApi {
  const sb = createClient();
  const check = ({ error }: { error: { message: string } | null }) => {
    if (error) throw new Error(error.message);
  };
  return {
    saveBoard: async (s) =>
      check(
        await sb
          .from("boards")
          .update({ title: s.board.title, emoji: s.board.emoji, colour: s.board.colour, viewport: s.board.viewport ?? null, updated_at: now() })
          .eq("id", boardId),
      ),
    upsertNodes: async (n) => check(await sb.from("board_nodes").upsert(n.map((x) => nodeRow(boardId, x)))),
    upsertEdges: async (e) => check(await sb.from("board_edges").upsert(e.map((x) => edgeRow(boardId, x)))),
    deleteNodes: async (ids) => check(await sb.from("board_nodes").delete().in("id", ids)),
    deleteEdges: async (ids) => check(await sb.from("board_edges").delete().in("id", ids)),
  };
}

/** My boards: from the account (logged in) + boards only on this device. */
export async function listBoards(loggedIn: boolean, { deleted = false } = {}): Promise<Board[]> {
  const local = (await idbAll<BoardState>("boards")).filter((s) => s.board.local && !!s.board.deleted_at === deleted).map((s) => s.board);
  if (!loggedIn) return local;
  const q = createClient().from("boards").select(BOARD_COLS).order("last_opened_at", { ascending: false, nullsFirst: false }).limit(300);
  const { data, error } = deleted ? await q.not("deleted_at", "is", null) : await q.is("deleted_at", null);
  if (error) {
    // offline: what this device has
    return [...(await idbAll<BoardState>("boards")).map((s) => s.board).filter((b) => !!b.deleted_at === deleted)];
  }
  return [...local, ...((data ?? []) as Board[])];
}

/** All my cards (for search on the Notes home). */
export async function listAllNodes(loggedIn: boolean): Promise<{ boardId: string; node: BoardNode }[]> {
  const out: { boardId: string; node: BoardNode }[] = [];
  for (const s of await idbAll<BoardState>("boards")) if (s.board.local) for (const n of s.nodes) out.push({ boardId: s.board.id, node: n });
  if (!loggedIn) return out;
  const { data } = await createClient().from("board_nodes").select("id, board_id, type, x, y, w, h, z_index, parent_id, data, updated_at").limit(3000);
  for (const r of (data ?? []) as NodeRow[]) out.push({ boardId: r.board_id, node: toNode(r) });
  return out;
}

export async function createBoard(
  input: { lessonId: string; subjectId?: string | null; title: string; emoji: string; colour: string; template: TemplateId; topic?: string },
  loggedIn: boolean,
): Promise<BoardState> {
  const t = now();
  const board: Board = {
    id: uid(),
    lesson_id: input.lessonId,
    subject_id: input.subjectId ?? null,
    title: input.title.trim().slice(0, 120) || "My notes",
    emoji: input.emoji || "notebook",
    colour: input.colour || "teal",
    template: input.template,
    viewport: null,
    created_at: t,
    updated_at: t,
    last_opened_at: t,
    local: !loggedIn,
  };
  const { nodes, edges } = buildTemplate(input.template, input.topic ?? board.title);
  const state: BoardState = { board, nodes, edges };
  if (loggedIn) {
    const sb = createClient();
    const { local: _l, ...row } = board;
    void _l;
    const { error } = await sb.from("boards").insert(row);
    if (error) throw new Error(/limit/i.test(error.message) ? "limit" : error.message);
    if (nodes.length) await sb.from("board_nodes").insert(nodes.map((n) => nodeRow(board.id, n)));
    if (edges.length) await sb.from("board_edges").insert(edges.map((e) => edgeRow(board.id, e)));
  }
  await cacheBoard(state);
  return state;
}

/**
 * Open a board: this device's copy first (instant, works offline); if it has no unsent changes, the account's
 * version replaces it (it may have been edited on another device).
 */
export async function loadBoard(id: string, loggedIn: boolean): Promise<{ state: BoardState | null; fromCache: boolean }> {
  const cached = await cachedBoard(id);
  if (cached?.board.local || !loggedIn) return { state: cached ?? null, fromCache: true };
  const pending = await loadPending(id);
  const hasPending = !!(pending.board || Object.keys(pending.nodes).length || Object.keys(pending.edges).length || pending.deletedNodes.length || pending.deletedEdges.length);
  if (cached && hasPending) return { state: cached, fromCache: true };
  const sb = createClient();
  const [b, n, e] = await Promise.all([
    sb.from("boards").select(BOARD_COLS).eq("id", id).maybeSingle(),
    sb.from("board_nodes").select("*").eq("board_id", id),
    sb.from("board_edges").select("*").eq("board_id", id),
  ]);
  if (b.error || n.error || e.error) return { state: cached ?? null, fromCache: true };
  if (!b.data) return { state: null, fromCache: false };
  const state: BoardState = { board: b.data as Board, nodes: ((n.data ?? []) as NodeRow[]).map(toNode), edges: ((e.data ?? []) as EdgeRow[]).map(toEdge) };
  await cacheBoard(state);
  void sb.from("boards").update({ last_opened_at: now() }).eq("id", id);
  return { state, fromCache: false };
}

/** Recently deleted (30 days), restore, delete forever. */
export async function softDeleteBoard(b: Board, loggedIn: boolean) {
  const cached = await cachedBoard(b.id);
  if (cached) await cacheBoard({ ...cached, board: { ...cached.board, deleted_at: now() } });
  if (loggedIn && !b.local) await createClient().from("boards").update({ deleted_at: now() }).eq("id", b.id);
}
export async function restoreBoard(b: Board, loggedIn: boolean) {
  const cached = await cachedBoard(b.id);
  if (cached) await cacheBoard({ ...cached, board: { ...cached.board, deleted_at: null } });
  if (loggedIn && !b.local) await createClient().from("boards").update({ deleted_at: null }).eq("id", b.id);
}
export async function deleteBoardForever(b: Board, loggedIn: boolean) {
  await idb("boards", b.id, null);
  await idb("pending", b.id, null);
  if (loggedIn && !b.local) {
    const sb = createClient();
    const me = (await sb.auth.getUser()).data.user?.id;
    if (me) {
      const { data } = await sb.storage.from("note-images").list(`${me}/${b.id}`);
      if (data?.length) await sb.storage.from("note-images").remove(data.map((f) => `${me}/${b.id}/${f.name}`));
    }
    await sb.from("boards").delete().eq("id", b.id);
  }
}
export async function purgeOld(loggedIn: boolean) {
  const cutoff = Date.now() - 30 * 86_400_000;
  for (const s of await idbAll<BoardState>("boards"))
    if (s.board.deleted_at && new Date(s.board.deleted_at).getTime() < cutoff) await idb("boards", s.board.id, null);
  if (loggedIn) await createClient().rpc("purge_my_deleted_boards");
}

/** After logging in: upload the boards that were only on this device. */
export async function localBoards(): Promise<BoardState[]> {
  return (await idbAll<BoardState>("boards")).filter((s) => s.board.local && !s.board.deleted_at);
}
export async function uploadLocalBoards(): Promise<number> {
  const sb = createClient();
  let n = 0;
  for (const s of await localBoards()) {
    const { local: _l, ...row } = s.board;
    void _l;
    const { error } = await sb.from("boards").insert(row);
    if (error) continue;
    const nodes = s.nodes.map((x) => ({ ...x, data: { ...x.data, image: x.data.image?.local ? { ...x.data.image } : x.data.image } }));
    if (nodes.length) await sb.from("board_nodes").insert(nodes.map((x) => nodeRow(s.board.id, x)));
    if (s.edges.length) await sb.from("board_edges").insert(s.edges.map((e) => edgeRow(s.board.id, e)));
    await cacheBoard({ ...s, board: { ...s.board, local: false } });
    n++;
  }
  return n;
}

/* ------------------------------------------------------------------ images (private bucket, own folder) */

/** Compress a photo to WebP (max 1600 px, ≤ 2 MB). */
export async function compressImage(file: File, maxSide = 1600): Promise<{ blob: Blob; w: number; h: number }> {
  const bmp = await createImageBitmap(file);
  let { width: w, height: h } = bmp;
  const k = Math.min(1, maxSide / Math.max(w, h));
  w = Math.round(w * k);
  h = Math.round(h * k);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  for (const q of [0.82, 0.7, 0.55, 0.4]) {
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/webp", q));
    if (blob && blob.size <= 2 * 1024 * 1024) return { blob, w, h };
  }
  throw new Error("This image is too big, even after compressing.");
}
export async function uploadImage(boardId: string, nodeId: string, blob: Blob): Promise<string> {
  const sb = createClient();
  const user = (await sb.auth.getUser()).data.user;
  if (!user) throw new Error("login");
  const path = `${user.id}/${boardId}/${nodeId}.webp`;
  const { error } = await sb.storage.from("note-images").upload(path, blob, { contentType: "image/webp", upsert: true });
  if (error) throw new Error(/policy|row-level/i.test(error.message) ? "Your image storage is full." : error.message);
  return path;
}
const signed = new Map<string, { url: string; at: number }>();
export async function imageUrl(path: string): Promise<string | null> {
  const hit = signed.get(path);
  if (hit && Date.now() - hit.at < 50 * 60_000) return hit.url;
  const { data } = await createClient().storage.from("note-images").createSignedUrl(path, 3600);
  if (data?.signedUrl) signed.set(path, { url: data.signedUrl, at: Date.now() });
  return data?.signedUrl ?? null;
}
export const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(b);
  });

/* ------------------------------------------------------------------ flashcards (SM-2) */

export type Flashcard = SrsState & { id: string; board_id: string; node_id: string; front: string; back: string; local?: boolean };

export async function saveFlashcard(boardId: string, nodeId: string, front: string, back: string, loggedIn: boolean, local: boolean): Promise<Flashcard> {
  const card: Flashcard = { id: uid(), board_id: boardId, node_id: nodeId, front: front.slice(0, 2000), back: back.slice(0, 4000), ...NEW_CARD() };
  if (!loggedIn || local) {
    await idb("flash", nodeId, { ...card, local: true });
    return card;
  }
  const { data, error } = await createClient()
    .from("flashcards")
    .upsert({ board_id: boardId, node_id: nodeId, front: card.front, back: card.back }, { onConflict: "user_id,node_id" })
    .select("id, board_id, node_id, front, back, ease, interval, reps, lapses, due_at")
    .single();
  if (error) throw new Error(error.message);
  return { ...(data as Flashcard), ease: Number((data as Flashcard).ease) };
}

/** Cards to review: all, or one board, or one lesson (by its boards). */
export async function dueCards(loggedIn: boolean, scope: { boardIds?: string[] } = {}, { all = false } = {}): Promise<Flashcard[]> {
  const nowIso = now();
  let out = (await idbAll<Flashcard>("flash")).filter((c) => all || c.due_at <= nowIso);
  if (loggedIn) {
    let q = createClient().from("flashcards").select("id, board_id, node_id, front, back, ease, interval, reps, lapses, due_at").order("due_at").limit(500);
    if (!all) q = q.lte("due_at", nowIso);
    if (scope.boardIds?.length) q = q.in("board_id", scope.boardIds);
    const { data } = await q;
    out = [...out, ...((data ?? []) as Flashcard[]).map((c) => ({ ...c, ease: Number(c.ease) }))];
  }
  if (scope.boardIds?.length) out = out.filter((c) => scope.boardIds!.includes(c.board_id));
  return out;
}
export async function dueCount(loggedIn: boolean): Promise<number> {
  const nowIso = now();
  let n = (await idbAll<Flashcard>("flash")).filter((c) => c.due_at <= nowIso).length;
  if (loggedIn) {
    const { count } = await createClient().from("flashcards").select("id", { count: "exact", head: true }).lte("due_at", nowIso);
    n += count ?? 0;
  }
  return n;
}
export async function rateCard(c: Flashcard, rating: Rating): Promise<Flashcard> {
  const next = { ...c, ...review(c, rating) };
  if (c.local) await idb("flash", c.node_id, next);
  else
    await createClient()
      .from("flashcards")
      .update({ ease: next.ease, interval: next.interval, reps: next.reps, lapses: next.lapses, due_at: next.due_at, updated_at: now() })
      .eq("id", c.id);
  return next;
}
export async function flashcardNodeIds(boardId: string, loggedIn: boolean): Promise<Set<string>> {
  const ids = new Set((await idbAll<Flashcard>("flash")).filter((c) => c.board_id === boardId).map((c) => c.node_id));
  if (loggedIn) {
    const { data } = await createClient().from("flashcards").select("node_id").eq("board_id", boardId);
    for (const r of data ?? []) ids.add(r.node_id as string);
  }
  return ids;
}

/* ------------------------------------------------------------------ add a card to a board from outside (lesson, Rem) */

/** Append a card to a board (quote from the lesson, Rem's answer). Works offline: it goes through the board's queue. */
export async function appendCard(boardId: string, node: Omit<BoardNode, "x" | "y" | "z" | "updated_at">, loggedIn: boolean) {
  // the latest copy (cards added on another device count when looking for a free spot)
  const fresh = loggedIn ? await loadBoard(boardId, true).catch(() => null) : null;
  const state = fresh?.state ?? (await cachedBoard(boardId));
  if (!state) throw new Error("Board not found");
  // An empty spot near the middle of the board's last view (the screen size is about this one's), never on a card.
  const vp = state.board.viewport;
  const b = boundsOf(state.nodes);
  const near = vp
    ? { x: (-vp.x + window.innerWidth / 2) / vp.zoom, y: (-vp.y + (window.innerHeight - 120) / 2) / vp.zoom }
    : b
      ? { x: b.x + b.w / 2, y: b.y + b.h / 2 }
      : { x: 0, y: 0 };
  const spot = freeSpot(state.nodes, node.w, node.h, near);
  const full: BoardNode = { ...node, ...spot, z: state.nodes.reduce((m, n) => Math.max(m, n.z), 0) + 1, updated_at: now() };
  const next: BoardState = { ...state, nodes: [...state.nodes, full] };
  await cacheBoard(next);
  if (loggedIn && !state.board.local) {
    try {
      await serverApi(boardId).upsertNodes([full]);
    } catch {
      const p = await loadPending(boardId);
      await savePending(boardId, { ...p, nodes: { ...p.nodes, [full.id]: full } });
    }
  }
  return full;
}
