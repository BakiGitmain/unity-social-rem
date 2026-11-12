/**
 * Offline-first saving for a board. Pure logic (tested): what changed since the last save (diff), a pending queue
 * that survives failures (offline), and one sync attempt against an API. Last write wins per card.
 */
import type { BoardEdge, BoardNode, BoardState } from "./types.ts";

export type Pending = {
  nodes: Record<string, BoardNode>;
  edges: Record<string, BoardEdge>;
  deletedNodes: string[];
  deletedEdges: string[];
  board: boolean;
};
export const EMPTY_PENDING: Pending = { nodes: {}, edges: {}, deletedNodes: [], deletedEdges: [], board: false };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Changes between the last saved state and the current one. */
export function diff(prev: BoardState | null, next: BoardState): Pending {
  const p: Pending = { nodes: {}, edges: {}, deletedNodes: [], deletedEdges: [], board: !prev || !same(prev.board, next.board) };
  const pn = new Map((prev?.nodes ?? []).map((n) => [n.id, n]));
  const pe = new Map((prev?.edges ?? []).map((e) => [e.id, e]));
  for (const n of next.nodes) if (!same(pn.get(n.id), n)) p.nodes[n.id] = n;
  for (const e of next.edges) if (!same(pe.get(e.id), e)) p.edges[e.id] = e;
  const nn = new Set(next.nodes.map((n) => n.id));
  const ne = new Set(next.edges.map((e) => e.id));
  p.deletedNodes = [...pn.keys()].filter((id) => !nn.has(id));
  p.deletedEdges = [...pe.keys()].filter((id) => !ne.has(id));
  return p;
}

/** Add new changes to what is still waiting (a newer version of a card replaces the older one). */
export function mergePending(a: Pending, b: Pending): Pending {
  const nodes = { ...a.nodes, ...b.nodes };
  const edges = { ...a.edges, ...b.edges };
  for (const id of b.deletedNodes) delete nodes[id];
  for (const id of b.deletedEdges) delete edges[id];
  const deletedNodes = [...new Set([...a.deletedNodes.filter((id) => !(id in b.nodes)), ...b.deletedNodes])];
  const deletedEdges = [...new Set([...a.deletedEdges.filter((id) => !(id in b.edges)), ...b.deletedEdges])];
  return { nodes, edges, deletedNodes, deletedEdges, board: a.board || b.board };
}

export const isEmpty = (p: Pending) =>
  !p.board && !Object.keys(p.nodes).length && !Object.keys(p.edges).length && !p.deletedNodes.length && !p.deletedEdges.length;

export type SyncApi = {
  saveBoard: (s: BoardState) => Promise<void>;
  upsertNodes: (n: BoardNode[]) => Promise<void>;
  upsertEdges: (e: BoardEdge[]) => Promise<void>;
  deleteNodes: (ids: string[]) => Promise<void>;
  deleteEdges: (ids: string[]) => Promise<void>;
};

/**
 * Try to send everything waiting. On failure (offline) NOTHING is lost: the same pending changes are returned and
 * tried again later. Edges are deleted before nodes and saved after them (foreign keys).
 */
export async function syncOnce(state: BoardState, pending: Pending, api: SyncApi): Promise<{ ok: boolean; pending: Pending }> {
  if (isEmpty(pending)) return { ok: true, pending };
  try {
    if (pending.board) await api.saveBoard(state);
    if (pending.deletedEdges.length) await api.deleteEdges(pending.deletedEdges);
    if (pending.deletedNodes.length) await api.deleteNodes(pending.deletedNodes);
    const nodes = Object.values(pending.nodes);
    if (nodes.length) await api.upsertNodes(nodes);
    const edges = Object.values(pending.edges);
    if (edges.length) await api.upsertEdges(edges);
    return { ok: true, pending: EMPTY_PENDING };
  } catch {
    return { ok: false, pending };
  }
}
