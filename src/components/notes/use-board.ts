"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cacheBoard, loadBoard, loadPending, savePending, serverApi } from "@/lib/notes/client";
import { diff, isEmpty, mergePending, syncOnce, EMPTY_PENDING, type Pending } from "@/lib/notes/sync";
import { createHistory } from "@/lib/ink/text";
import { now, type Board, type BoardEdge, type BoardNode, type BoardState } from "@/lib/notes/types";

export type SaveStatus = "saved" | "saving" | "offline" | "local";
type Content = { nodes: BoardNode[]; edges: BoardEdge[] };

/**
 * One board: load (this device first, then the account), undo / redo, and offline-first autosave
 * (~800 ms after the last change; "Offline" keeps everything on this device and retries when back online).
 */
export function useBoard(boardId: string, loggedIn: boolean, ready: boolean) {
  const [state, setState] = useState<BoardState | null>(null);
  const [missing, setMissing] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [hist, setHist] = useState({ undo: false, redo: false });
  const history = useRef(createHistory<Content>({ nodes: [], edges: [] }));
  const saved = useRef<BoardState | null>(null);
  const pending = useRef<Pending>(EMPTY_PENDING);
  const stateRef = useRef<BoardState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const syncing = useRef(false);
  /** Changes made WHILE a save is on its way: kept apart, then sent right after it (never lost). */
  const during = useRef<Pending>(EMPTY_PENDING);
  const again = useRef<() => void>(() => {});

  /* save */
  const flush = useCallback(async () => {
    const s = stateRef.current;
    if (!s || syncing.current) return;
    if (s.board.local || !loggedIn) {
      await cacheBoard(s);
      setStatus("local");
      return;
    }
    syncing.current = true;
    during.current = EMPTY_PENDING;
    setStatus("saving");
    const r = await syncOnce(s, pending.current, serverApi(boardId));
    syncing.current = false;
    const later = during.current;
    during.current = EMPTY_PENDING;
    pending.current = mergePending(r.pending, later);
    await savePending(boardId, isEmpty(pending.current) ? null : pending.current);
    if (r.ok) saved.current = s;
    if (r.ok && !isEmpty(later)) {
      // more changes came in while saving: send them now
      setStatus("saving");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => again.current(), 50);
      return;
    }
    setStatus(r.ok ? "saved" : "offline");
  }, [boardId, loggedIn]);

  useEffect(() => {
    again.current = () => void flush();
  }, [flush]);

  /* load */
  useEffect(() => {
    if (!ready) return;
    let stop = false;
    void (async () => {
      const { state: s } = await loadBoard(boardId, loggedIn);
      if (stop) return;
      if (!s) return setMissing(true);
      pending.current = await loadPending(boardId);
      saved.current = s;
      stateRef.current = s;
      history.current.reset({ nodes: s.nodes, edges: s.edges });
      setState(s);
      setStatus(s.board.local ? "local" : isEmpty(pending.current) ? "saved" : "offline");
      if (!isEmpty(pending.current)) flush();
    })();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, loggedIn, ready]);

  // back online → send what is waiting
  useEffect(() => {
    const on = () => void flush();
    window.addEventListener("online", on);
    const retry = setInterval(() => !isEmpty(pending.current) && navigator.onLine && void flush(), 20_000);
    return () => {
      window.removeEventListener("online", on);
      clearInterval(retry);
    };
  }, [flush]);

  // leaving the page: try once more
  useEffect(() => () => void flush(), [flush]);

  /** Apply a new state: remember the change, keep a device copy, save soon. */
  const commit = useCallback(
    (next: BoardState, { record = true }: { record?: boolean } = {}) => {
      const prev = stateRef.current;
      stateRef.current = next;
      setState(next);
      if (record) {
        history.current.push({ nodes: next.nodes, edges: next.edges });
        setHist({ undo: history.current.canUndo, redo: history.current.canRedo });
      }
      if (prev) {
        const d = diff(prev, next);
        pending.current = mergePending(pending.current, d);
        if (syncing.current) during.current = mergePending(during.current, d);
      }
      void cacheBoard(next);
      if (!next.board.local && loggedIn) void savePending(boardId, pending.current);
      clearTimeout(timer.current);
      setStatus(next.board.local || !loggedIn ? "local" : "saving");
      timer.current = setTimeout(() => void flush(), 800);
    },
    [boardId, loggedIn, flush],
  );

  const setContent = useCallback(
    (fn: (c: Content) => Content, opts?: { record?: boolean }) => {
      const s = stateRef.current;
      if (!s) return;
      const c = fn({ nodes: s.nodes, edges: s.edges });
      commit({ ...s, nodes: c.nodes, edges: c.edges }, opts);
    },
    [commit],
  );
  const setBoard = useCallback(
    (patch: Partial<Board>) => {
      const s = stateRef.current;
      if (!s) return;
      commit({ ...s, board: { ...s.board, ...patch, updated_at: now() } }, { record: false });
    },
    [commit],
  );
  const undo = useCallback(() => {
    const s = stateRef.current;
    if (!s || !history.current.canUndo) return;
    const c = history.current.undo();
    commit({ ...s, nodes: c.nodes, edges: c.edges }, { record: false });
    setHist({ undo: history.current.canUndo, redo: history.current.canRedo });
  }, [commit]);
  const redo = useCallback(() => {
    const s = stateRef.current;
    if (!s || !history.current.canRedo) return;
    const c = history.current.redo();
    commit({ ...s, nodes: c.nodes, edges: c.edges }, { record: false });
    setHist({ undo: history.current.canUndo, redo: history.current.canRedo });
  }, [commit]);
  /** Record the current content as one undo step (after a drag ends). */
  const checkpoint = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    history.current.push({ nodes: s.nodes, edges: s.edges });
    setHist({ undo: history.current.canUndo, redo: history.current.canRedo });
  }, []);

  return { state, missing, status, setContent, setBoard, undo, redo, checkpoint, canUndo: hist.undo, canRedo: hist.redo, flush };
}
