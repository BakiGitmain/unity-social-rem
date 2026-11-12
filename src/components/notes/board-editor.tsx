"use client";

/* The React Compiler skips this large interactive file (hand-written memos/callbacks are kept as they are). */
/* eslint-disable react-hooks/preserve-manual-memoization */
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  ControlButton,
  ViewportPortal,
  getNodesBounds,
  getViewportForBounds,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type Viewport as RFViewport,
} from "@xyflow/react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckSquare,
  ChevronDown,
  CloudOff,
  Copy,
  Download,
  FileText,
  Frame,
  HelpCircle,
  Image as ImageIcon,
  LayoutGrid,
  Maximize,
  Link2,
  List,
  Loader2,
  MousePointer2,
  NotebookPen,
  PenLine,
  Plus,
  Quote,
  Redo2,
  Search,
  Spline,
  Sparkles,
  StickyNote,
  Trash2,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import { BoardContext, CardNode, COLOR_BG, TextEditor, type BoardCtx } from "@/components/notes/card-node";
import { BoardIcon } from "@/components/notes/board-icon";
import { OutlineView } from "@/components/notes/outline-view";
import { useBoard } from "@/components/notes/use-board";
import { useUser } from "@/components/user-provider";
import { InkEditor, useInkDoc } from "@/components/ink/ink-editor";
import type { InkDoc } from "@/lib/ink/model";
import { snap as snapBoxes, type Guide } from "@/lib/ink/transform";
import { blobToDataUrl, compressImage, flashcardNodeIds, imageUrl, saveFlashcard, softDeleteBoard, uploadImage as uploadToBucket } from "@/lib/notes/client";
import { notifyDue } from "@/lib/notes/use-due";
import { boundsOf, freeSpot, tidy } from "@/lib/notes/layout";
import { buildOutline, toMarkdown } from "@/lib/notes/outline";
import { CARD_COLORS, CARD_SIZE, cardText, now, uid, type BoardEdge, type BoardNode, type CardColor, type CardData, type CardType } from "@/lib/notes/types";
import type { NotesLesson } from "@/lib/data";
import type { Locale } from "@/lib/locale";
import { t } from "@/lib/site-i18n";
import { subjectStyle } from "@/lib/subjects";

const nodeTypes = { card: CardNode };
const EDGE_COLORS = ["#5c6a6d", "#0f766e", "#2563c9", "#c2410c", "#b4472e"];
const CLIP_KEY = "usr-notes-clipboard";
const ADD_ITEMS: { type: CardType; label: string; Icon: typeof Plus }[] = [
  { type: "note", label: "Note card", Icon: NotebookPen },
  { type: "sticky", label: "Sticky note", Icon: StickyNote },
  { type: "quote", label: "Lesson quote", Icon: Quote },
  { type: "image", label: "Image", Icon: ImageIcon },
  { type: "drawing", label: "Drawing", Icon: PenLine },
  { type: "link", label: "Link", Icon: Link2 },
  { type: "checklist", label: "Checklist", Icon: CheckSquare },
  { type: "frame", label: "Frame / group", Icon: Frame },
];
const spring = { type: "spring", stiffness: 480, damping: 36 } as const;

function useMedia(q: string) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}

export default function BoardEditor(props: { boardId: string; locale: Locale; lessons: NotesLesson[] }) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  );
}

type Menu = { kind: "card"; id: string; x: number; y: number } | { kind: "add"; x: number; y: number; at?: { x: number; y: number } } | null;
type AiPanel = { mode: "summary" | "check" | "flashcards"; loading: boolean; text?: string; cards?: { front: string; back: string; keep: boolean }[]; from?: string; error?: string } | null;

function Editor({ boardId, locale, lessons }: { boardId: string; locale: Locale; lessons: NotesLesson[] }) {
  const router = useRouter();
  const rf = useReactFlow();
  const { username, loading: userLoading } = useUser();
  const loggedIn = !!username;
  const board = useBoard(boardId, loggedIn, !userLoading);
  const { state, status, setContent, setBoard, undo, redo } = board;
  const phone = useMedia("(max-width: 767px)");
  const tiny = useMedia("(max-width: 399px)");
  const am = locale === "am";
  const tr = (k: Parameters<typeof t>[1], v?: Record<string, string | number>) => t(locale, k, v);

  const [override, setOverride] = useState<Map<string, { x: number; y: number; w?: number; h?: number }>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selEdge, setSelEdge] = useState<string | null>(null);
  const [editingId, setEditing] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const [outline, setOutline] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [matchIdx, setMatchIdx] = useState(0);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [ai, setAi] = useState<AiPanel>(null);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [images, setImages] = useState<Record<string, string>>({});
  const [guides, setGuides] = useState<Guide[]>([]);
  const [tidying, setTidying] = useState(false);
  const [newEdges, setNewEdges] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [rename, setRename] = useState(false);
  const dragStart = useRef<Map<string, { x: number; y: number }>>(new Map());
  const wrap = useRef<HTMLDivElement>(null);
  // React Flow mounts only once its box has a real size (it warns when measured at 0 × 0).
  const [canvasReady, setCanvasReady] = useState(false);
  const canvasRef = useCallback((el: HTMLDivElement | null) => {
    wrap.current = el;
    if (!el) return;
    const check = () => setCanvasReady(el.clientWidth > 0 && el.clientHeight > 0);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      ro.disconnect();
      setCanvasReady(false);
    };
  }, []);
  const searchInput = useRef<HTMLInputElement>(null);

  const lesson = useMemo(() => lessons.find((l) => l.id === state?.board.lesson_id), [lessons, state?.board.lesson_id]);
  const lessonLabel = lesson ? `${am ? lesson.subject.name_am : lesson.subject.name_en} · ${lesson.code} ${am ? lesson.title_am : lesson.title_en}` : undefined;
  const showOutline = outline ?? tiny;
  const nodes = useMemo(() => state?.nodes ?? [], [state?.nodes]);
  const edges = useMemo(() => state?.edges ?? [], [state?.edges]);

  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  /* ?card=<id> (from the Notes search): select that card and zoom to it, once */
  const focused = useRef(false);
  useEffect(() => {
    if (!state || focused.current) return;
    focused.current = true;
    const id = new URLSearchParams(window.location.search).get("card");
    if (!id || !state.nodes.some((n) => n.id === id)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(new Set([id]));
    setTimeout(() => void rf.fitView({ nodes: [{ id }], duration: 500, maxZoom: 1.2, padding: 0.6 }), 300);
  }, [state, rf]);

  /* flashcards on this board + signed image URLs */
  useEffect(() => {
    if (!state) return;
    void flashcardNodeIds(state.board.id, loggedIn).then(setFlashIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.board.id, loggedIn]);
  useEffect(() => {
    for (const n of nodes)
      if (n.data.image?.path && !images[n.data.image.path])
        void imageUrl(n.data.image.path).then((u) => u && setImages((m) => ({ ...m, [n.data.image!.path!]: u })));
  }, [nodes, images]);

  /* search */
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as string[];
    return nodes.filter((n) => cardText(n).toLowerCase().includes(q)).map((n) => n.id);
  }, [nodes, query]);
  const matchSet = useMemo(() => new Set(matches), [matches]);
  const goToMatch = useCallback(
    (i: number) => {
      if (!matches.length) return;
      const id = matches[((i % matches.length) + matches.length) % matches.length]!;
      setMatchIdx(i);
      void rf.fitView({ nodes: [{ id }], duration: 500, maxZoom: 1.2, padding: 0.6 });
    },
    [matches, rf],
  );
  // zoom to the first match while typing (no state change here)
  useEffect(() => {
    if (matches[0]) void rf.fitView({ nodes: [{ id: matches[0] }], duration: 500, maxZoom: 1.2, padding: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  /* ---------------- editing helpers ---------------- */

  const update = useCallback(
    (id: string, patch: Partial<CardData>, opts?: { record?: boolean }) =>
      setContent((c) => ({ ...c, nodes: c.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch }, updated_at: now() } : n)) }), opts),
    [setContent],
  );
  const center = useCallback(() => {
    const r = wrap.current?.getBoundingClientRect();
    return rf.screenToFlowPosition({ x: (r?.left ?? 0) + (r?.width ?? 800) / 2, y: (r?.top ?? 0) + (r?.height ?? 600) / 2 });
  }, [rf]);

  /**
   * Fit EVERY card into the visible area (React Flow's own fitView only counts cards it has drawn, and off-screen cards
   * are never drawn). Leaves room for the floating Add button / the phone toolbar at the bottom.
   */
  /* "Saving…" → "Saved ✓" for 2 s after each save, then it fades away */
  const [justSaved, setJustSaved] = useState(false);
  const prevStatus = useRef(status);
  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = status;
    if (status !== "saved" || (was !== "saving" && was !== "offline")) return; // also when back online
    setJustSaved(true);
    const t = setTimeout(() => setJustSaved(false), 2000);
    return () => clearTimeout(t);
  }, [status]);

  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  const fitAll = useCallback(
    (duration = 400) => {
      const b = boundsOf(nodesRef.current);
      const r = wrap.current?.getBoundingClientRect();
      if (!b || !r?.width || !r.height) return;
      const pad = { top: "28px", left: "24px", right: "24px", bottom: phone ? "104px" : "96px" } as const;
      const vp = getViewportForBounds({ x: b.x, y: b.y, width: b.w, height: b.h }, r.width, r.height, 0.1, 1, pad);
      void rf.setViewport(vp, { duration });
    },
    [rf, phone],
  );
  /** Pan (keeping the zoom) so a card is fully in view, if it isn't already. */
  const reveal = useCallback(
    (n: { x: number; y: number; w: number; h: number }) => {
      const r = wrap.current?.getBoundingClientRect();
      if (!r) return;
      const a = rf.screenToFlowPosition({ x: r.left + 24, y: r.top + 24 });
      const b = rf.screenToFlowPosition({ x: r.right - 24, y: r.bottom - (phone ? 104 : 96) });
      if (n.x >= a.x && n.y >= a.y && n.x + n.w <= b.x && n.y + n.h <= b.y) return;
      void rf.setCenter(n.x + n.w / 2, n.y + n.h / 2, { zoom: rf.getZoom(), duration: 400 });
    },
    [rf, phone],
  );

  const addCard = useCallback(
    (type: CardType, at?: { x: number; y: number }, data: CardData = {}) => {
      const size = CARD_SIZE[type];
      // an empty spot near the view centre (or the right-clicked point): never on top of another card
      const spot = freeSpot(nodes, size.w, size.h, at ?? center());
      const z = nodes.reduce((m, n) => Math.max(m, n.z), 0) + 1;
      const n: BoardNode = {
        id: uid(),
        type,
        x: spot.x,
        y: spot.y,
        w: size.w,
        h: size.h,
        z: type === "frame" ? 0 : z,
        data: {
          ...(type === "sticky" ? { color: "yellow" as CardColor } : {}),
          ...(type === "checklist" ? { title: "To do", items: [] } : {}),
          ...(type === "frame" ? { title: "Group" } : {}),
          ...(type === "drawing" ? { drawing: { items: [], paper: "blank", template: "none" } } : {}),
          ...(type === "quote" ? { quote: { text: "Select text in the lesson and tap “Add to notes” to quote it here.", lessonId: state?.board.lesson_id ?? "", href: lesson?.href ?? "/", lessonLabel } } : {}),
          ...data,
        },
        updated_at: now(),
      };
      setContent((c) => ({ ...c, nodes: [...c.nodes, n] }));
      setSelected(new Set([n.id]));
      setMenu(null);
      reveal(n);
      if (type === "drawing") setDrawingId(n.id);
      else if (type !== "image" && type !== "quote") setEditing(n.id);
      return n;
    },
    [center, reveal, nodes, setContent, state?.board.lesson_id, lesson, lessonLabel],
  );

  const removeNodes = useCallback(
    (ids: Set<string>) => {
      if (!ids.size) return;
      setContent((c) => ({
        nodes: c.nodes.filter((n) => !ids.has(n.id)).map((n) => (n.parent && ids.has(n.parent) ? { ...n, parent: null } : n)),
        edges: c.edges.filter((e) => !ids.has(e.source) && !ids.has(e.target)),
      }));
      setSelected(new Set());
    },
    [setContent],
  );
  const duplicate = useCallback(
    (ids: Set<string>) => {
      const map = new Map<string, string>();
      const copies = nodes.filter((n) => ids.has(n.id)).map((n) => {
        const id = uid();
        map.set(n.id, id);
        return { ...n, id, x: n.x + 40, y: n.y + 40, z: n.z + 1, updated_at: now(), data: { ...n.data, flashcard: false } };
      });
      for (const c of copies) if (c.parent) c.parent = map.get(c.parent) ?? c.parent;
      const ecopies = edges.filter((e) => map.has(e.source) && map.has(e.target)).map((e) => ({ ...e, id: uid(), source: map.get(e.source)!, target: map.get(e.target)!, updated_at: now() }));
      setContent((c) => ({ nodes: [...c.nodes, ...copies], edges: [...c.edges, ...ecopies] }));
      setSelected(new Set(copies.map((c) => c.id)));
    },
    [nodes, edges, setContent],
  );
  const copy = useCallback(() => {
    const ns = nodes.filter((n) => selected.has(n.id));
    if (!ns.length) return;
    const es = edges.filter((e) => selected.has(e.source) && selected.has(e.target));
    try {
      window.localStorage.setItem(CLIP_KEY, JSON.stringify({ nodes: ns, edges: es }));
      say(`${ns.length} card${ns.length === 1 ? "" : "s"} copied`);
    } catch {}
  }, [nodes, edges, selected]);
  const paste = useCallback(() => {
    let clip: { nodes: BoardNode[]; edges: BoardEdge[] } | null = null;
    try {
      clip = JSON.parse(window.localStorage.getItem(CLIP_KEY) ?? "null");
    } catch {}
    if (!clip?.nodes?.length) return;
    const c0 = center();
    const minX = Math.min(...clip.nodes.map((n) => n.x)),
      minY = Math.min(...clip.nodes.map((n) => n.y));
    const map = new Map<string, string>();
    const ns = clip.nodes.map((n) => {
      const id = uid();
      map.set(n.id, id);
      return { ...n, id, x: Math.round(c0.x - 100 + n.x - minX), y: Math.round(c0.y - 60 + n.y - minY), updated_at: now(), data: { ...n.data, flashcard: false } };
    });
    for (const n of ns) n.parent = n.parent ? (map.get(n.parent) ?? null) : null;
    const es = clip.edges.filter((e) => map.has(e.source) && map.has(e.target)).map((e) => ({ ...e, id: uid(), source: map.get(e.source)!, target: map.get(e.target)!, updated_at: now() }));
    setContent((c) => ({ nodes: [...c.nodes, ...ns], edges: [...c.edges, ...es] }));
    setSelected(new Set(ns.map((n) => n.id)));
  }, [center, setContent]);

  const connect = useCallback(
    (source: string, target: string) => {
      if (source === target || edges.some((e) => e.source === source && e.target === target)) return;
      const e: BoardEdge = { id: uid(), source, target, label: "", style: {}, updated_at: now() };
      setContent((c) => ({ ...c, edges: [...c.edges, e] }));
      setNewEdges((s) => new Set(s).add(e.id));
      setSelEdge(e.id);
    },
    [edges, setContent],
  );

  const doTidy = useCallback(() => {
    const pos = tidy(nodes, edges);
    setTidying(true);
    setContent((c) => {
      // move frames' cards with their frame
      const moved = new Map<string, { dx: number; dy: number }>();
      const out = c.nodes.map((n) => {
        const p = pos.get(n.id);
        if (!p) return n;
        if (n.type === "frame") moved.set(n.id, { dx: p.x - n.x, dy: p.y - n.y });
        return { ...n, x: p.x, y: p.y, updated_at: now() };
      });
      return { ...c, nodes: out.map((n) => (n.parent && moved.has(n.parent) ? { ...n, x: n.x + moved.get(n.parent)!.dx, y: n.y + moved.get(n.parent)!.dy } : n)) };
    });
    setTimeout(() => {
      setTidying(false);
      fitAll(500);
    }, 460);
  }, [nodes, edges, setContent, fitAll]);

  /* flashcards + AI */
  /** "Make flashcard" opens a small dialog (front = title, back = text) to edit before saving. */
  const [flashDraft, setFlashDraft] = useState<{ id: string; front: string; back: string } | null>(null);
  const makeFlashcard = useCallback((n: BoardNode) => {
    const text = cardText(n);
    const [first, ...rest] = text.split("\n");
    const front = n.data.title?.trim() || first || "";
    const back = (n.data.title ? (n.data.body ?? rest.join("\n")) : rest.join("\n")).trim();
    setMenu(null);
    setFlashDraft({ id: n.id, front: front.slice(0, 500), back: back.slice(0, 4000) });
  }, []);
  const saveFlash = useCallback(
    async (d: { id: string; front: string; back: string }) => {
      try {
        await saveFlashcard(boardId, d.id, d.front.trim(), d.back.trim(), loggedIn, !!state?.board.local);
        setFlashDraft(null);
        setFlashIds((s) => new Set(s).add(d.id));
        update(d.id, { flashcard: true }, { record: false });
        notifyDue();
        say("Flashcard made ✓");
      } catch {
        say("Could not make the flashcard");
      }
    },
    [boardId, loggedIn, state?.board.local, update],
  );
  const runAi = useCallback(
    async (mode: "summary" | "check" | "flashcards", from?: BoardNode) => {
      setAiOpen(false);
      setMenu(null);
      if (!loggedIn) return setAi({ mode, loading: false, error: "Log in to use Rem AI on your notes." });
      const text = from ? cardText(from) : buildOutline(nodes, edges).map((i) => `${i.title}\n${i.text}`).join("\n\n");
      if (!text.trim()) return setAi({ mode, loading: false, error: "Write some notes first." });
      setAi({ mode, loading: true, from: from?.id });
      try {
        const res = await fetch("/api/notes-ai", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode, lessonId: state?.board.lesson_id, text, locale }),
        });
        const data = (await res.json().catch(() => ({}))) as { text?: string; cards?: { front: string; back: string }[]; error?: string };
        if (!res.ok)
          return setAi({
            mode,
            loading: false,
            error: data.error === "limit" ? "You've used today's Rem questions." : data.error === "login_required" ? "Log in to use Rem AI." : "Rem is resting right now. Try later.",
          });
        setAi({ mode, loading: false, text: data.text, cards: data.cards?.map((c) => ({ ...c, keep: true })), from: from?.id });
      } catch {
        setAi({ mode, loading: false, error: "Rem couldn't answer right now." });
      }
    },
    [loggedIn, nodes, edges, state?.board.lesson_id, locale],
  );

  /* images */
  const uploadImage = useCallback(
    async (id: string, file: File) => {
      try {
        const { blob, w, h } = await compressImage(file);
        if (loggedIn && !state?.board.local) {
          const path = await uploadToBucket(boardId, id, blob);
          update(id, { image: { path, w, h } });
        } else update(id, { image: { local: await blobToDataUrl(blob), w, h } });
        setContent((c) => ({ ...c, nodes: c.nodes.map((n) => (n.id === id ? { ...n, h: Math.round((n.w * h) / w) + 28 } : n)) }), { record: false });
      } catch (e) {
        say(e instanceof Error ? e.message : "Upload failed");
      }
    },
    [boardId, loggedIn, state?.board.local, update, setContent],
  );

  const ctx: BoardCtx = useMemo(
    () => ({
      update,
      editingId,
      setEditing,
      openMenu: (id, x, y) => setMenu({ kind: "card", id, x, y }),
      openDrawing: (id) => setDrawingId(id),
      uploadImage: (id, f) => void uploadImage(id, f),
      imageSrc: (n) => n.data.image?.local ?? (n.data.image?.path ? (images[n.data.image.path] ?? null) : null),
      flashIds,
      matches: matchSet,
      connectFrom,
      phone,
      am,
    }),
    [update, editingId, uploadImage, images, flashIds, matchSet, connectFrom, phone, am],
  );

  /* ---------------- React Flow wiring ---------------- */

  const rfNodes: Node[] = useMemo(
    () =>
      nodes.map((n) => {
        const o = override.get(n.id);
        const w = o?.w ?? n.w,
          h = o?.h ?? n.h;
        return {
          id: n.id,
          type: "card",
          position: { x: o?.x ?? n.x, y: o?.y ?? n.y },
          data: { node: n },
          width: w,
          height: h,
          style: { width: w, height: h },
          selected: selected.has(n.id),
          zIndex: n.type === "frame" ? -1 : n.z,
          draggable: editingId !== n.id,
          ariaLabel: `${n.type}: ${n.data.title ?? cardText(n).slice(0, 40)}`,
        };
      }),
    [nodes, override, selected, editingId],
  );
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const rfEdges: Edge[] = useMemo(
    () =>
      edges.map((e) => {
        const color = e.style?.color ?? "#5c6a6d";
        // Attach to the sides that face each other, so the curve is smooth and short.
        const a = nodeById.get(e.source),
          b = nodeById.get(e.target);
        let sh = "Right",
          th = "Left";
        if (a && b) {
          const oa = override.get(a.id),
            ob = override.get(b.id);
          const dx = (ob?.x ?? b.x) + b.w / 2 - ((oa?.x ?? a.x) + a.w / 2);
          const dy = (ob?.y ?? b.y) + b.h / 2 - ((oa?.y ?? a.y) + a.h / 2);
          if (Math.abs(dx) >= Math.abs(dy)) [sh, th] = dx >= 0 ? ["Right", "Left"] : ["Left", "Right"];
          else [sh, th] = dy >= 0 ? ["Bottom", "Top"] : ["Top", "Bottom"];
        }
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: sh,
          targetHandle: th,
          type: "default",
          label: e.label || undefined,
          selected: selEdge === e.id,
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
          style: { stroke: color, strokeWidth: selEdge === e.id ? 3 : 2, strokeDasharray: e.style?.dashed ? "7 6" : undefined },
          labelStyle: { fontSize: 12, fontWeight: 600, fill: "#1d2a2c" },
          labelBgStyle: { fill: "#ffffff" },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 8,
          className: newEdges.has(e.id) ? "notes-edge-draw" : undefined,
          interactionWidth: 18,
        };
      }),
    [edges, selEdge, newEdges, nodeById, override],
  );

  const framesOf = (ids: Set<string>) => nodes.filter((n) => n.type === "frame" && ids.has(n.id));
  const childrenOf = (frame: BoardNode) =>
    nodes.filter((n) => n.id !== frame.id && n.type !== "frame" && (n.parent === frame.id || (!n.parent && n.x >= frame.x && n.y >= frame.y && n.x + n.w <= frame.x + frame.w && n.y + n.h <= frame.y + frame.h)));

  /** Write the dragged / resized positions into the board (one undo step). */
  const commitOverride = useCallback(
    (ov: Map<string, { x: number; y: number; w?: number; h?: number }>) => {
      if (!ov.size) return;
      const frames = nodes.filter((n) => n.type === "frame");
      setContent((c) => ({
        ...c,
        nodes: c.nodes.map((n) => {
          const o = ov.get(n.id);
          if (!o) return n;
          const next = { ...n, x: Math.round(o.x), y: Math.round(o.y), w: Math.round(o.w ?? n.w), h: Math.round(o.h ?? n.h), updated_at: now() };
          if (n.type !== "frame") {
            // dropped inside a frame → it belongs to that frame
            const cx = next.x + next.w / 2,
              cy = next.y + next.h / 2;
            const f = frames.find((fr) => {
              const fo = ov.get(fr.id) ?? fr;
              const fw = (fo as { w?: number }).w ?? fr.w,
                fh = (fo as { h?: number }).h ?? fr.h;
              return cx >= fo.x && cx <= fo.x + fw && cy >= fo.y && cy <= fo.y + fh;
            });
            next.parent = f?.id ?? null;
          }
          return next;
        }),
      }));
      setOverride(new Map());
      setGuides([]);
      dragStart.current.clear();
    },
    [nodes, setContent],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      let sel: Set<string> | null = null;
      const ov = new Map(override);
      let touched = false;
      const dragging = changes.filter((c): c is Extract<NodeChange, { type: "position" }> => c.type === "position" && !!c.dragging);
      for (const c of changes) {
        if (c.type === "select") {
          sel ??= new Set(selected);
          if (c.selected) sel.add(c.id);
          else sel.delete(c.id);
        } else if (c.type === "position" && c.position && c.dragging) {
          let { x, y } = c.position;
          // alignment guides when dragging one card
          if (dragging.length === 1) {
            const n = nodes.find((m) => m.id === c.id);
            if (n) {
              const others = nodes.filter((m) => m.id !== n.id).map((m) => ({ minX: m.x, minY: m.y, maxX: m.x + m.w, maxY: m.y + m.h }));
              const s = snapBoxes({ minX: x, minY: y, maxX: x + n.w, maxY: y + n.h }, others, [], 6 / rf.getZoom());
              x += s.dx;
              y += s.dy;
              setGuides(s.guides);
            }
          }
          ov.set(c.id, { ...ov.get(c.id), x, y });
          // a frame drags its cards along
          const start = dragStart.current.get(c.id);
          const node = nodes.find((m) => m.id === c.id);
          if (node?.type === "frame" && start) {
            for (const ch of childrenOf(node)) {
              if (dragging.some((d) => d.id === ch.id)) continue;
              const s0 = dragStart.current.get(ch.id) ?? { x: ch.x, y: ch.y };
              dragStart.current.set(ch.id, s0);
              ov.set(ch.id, { ...ov.get(ch.id), x: s0.x + (x - start.x), y: s0.y + (y - start.y) });
            }
          }
          touched = true;
        } else if (c.type === "dimensions" && "resizing" in c && c.dimensions) {
          ov.set(c.id, { ...ov.get(c.id), x: ov.get(c.id)?.x ?? nodes.find((m) => m.id === c.id)?.x ?? 0, y: ov.get(c.id)?.y ?? nodes.find((m) => m.id === c.id)?.y ?? 0, w: c.dimensions.width, h: c.dimensions.height });
          touched = true;
          if (c.resizing === false) commitOverride(ov);
        } else if (c.type === "position" && c.position && !c.dragging && ov.has(c.id)) {
          // resize from a top / left handle moves the card too
          ov.set(c.id, { ...ov.get(c.id)!, x: c.position.x, y: c.position.y });
          touched = true;
        }
      }
      if (sel) {
        setSelected(sel);
        if (sel.size) setSelEdge(null);
      }
      if (touched) setOverride(ov);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [override, selected, nodes, rf],
  );

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    for (const c of changes) if (c.type === "select" && c.selected) setSelEdge(c.id);
  }, []);

  /* keyboard shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && k === "y") {
        e.preventDefault();
        redo();
      } else if (mod && k === "d") {
        e.preventDefault();
        duplicate(selected);
      } else if (mod && k === "c") copy();
      else if (mod && k === "v") paste();
      else if (mod && k === "a") {
        e.preventDefault();
        setSelected(new Set(nodes.map((n) => n.id)));
      } else if (mod && k === "f") {
        e.preventDefault();
        searchInput.current?.focus();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selEdge) {
          setContent((c) => ({ ...c, edges: c.edges.filter((x) => x.id !== selEdge) }));
          setSelEdge(null);
        } else removeNodes(selected);
      } else if (!mod && k === "n") {
        e.preventDefault();
        addCard("note");
      } else if (!mod && k === "s" && !e.shiftKey) {
        e.preventDefault();
        addCard("sticky");
      } else if (!mod && k === "f") fitAll();
      else if (!mod && k === "t") doTidy();
      else if (!mod && k === "o") setOutline((o) => !(o ?? tiny));
      else if (e.key === "?") setHelp((h) => !h);
      else if (e.key === "Escape") {
        setSelected(new Set());
        setSelEdge(null);
        setMenu(null);
        setConnectFrom(null);
        setHelp(false);
      } else if (e.key === "Enter" && selected.size === 1) {
        e.preventDefault();
        setEditing([...selected][0]!);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, duplicate, copy, paste, selected, selEdge, nodes, setContent, removeNodes, addCard, fitAll, doTidy, tiny]);

  /* long-press (touch): empty paper → "Add here"; a card → its menu */
  const press = useRef<{ t: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    const target = e.target as HTMLElement;
    const x = e.clientX,
      y = e.clientY;
    if (press.current) clearTimeout(press.current.t);
    press.current = {
      x,
      y,
      t: setTimeout(() => {
        press.current = null;
        const nodeEl = target.closest(".react-flow__node") as HTMLElement | null;
        try {
          navigator.vibrate?.(10);
        } catch {}
        if (nodeEl?.dataset.id) setMenu({ kind: "card", id: nodeEl.dataset.id, x, y });
        else if (target.closest(".react-flow__pane")) setMenu({ kind: "add", x, y, at: rf.screenToFlowPosition({ x, y }) });
      }, 550),
    };
  };
  const cancelPress = (e?: React.PointerEvent) => {
    if (!press.current) return;
    if (e && e.type === "pointermove" && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) < 8) return;
    clearTimeout(press.current.t);
    press.current = null;
  };

  /* viewport is remembered per board */
  const onMoveEnd = useCallback((_: unknown, vp: RFViewport) => setBoard({ viewport: { x: vp.x, y: vp.y, zoom: vp.zoom } }), [setBoard]);

  /* export */
  const exportPng = async () => {
    setExportOpen(false);
    const { toPng } = await import("html-to-image");
    const el = document.querySelector(".react-flow__viewport") as HTMLElement | null;
    if (!el || !nodes.length) return;
    const b = getNodesBounds(rf.getNodes());
    const W = Math.min(2400, Math.max(800, Math.round(b.width + 160))),
      H = Math.min(2400, Math.max(500, Math.round(b.height + 160)));
    const vp = getViewportForBounds(b, W, H, 0.1, 2, 0.08);
    const url = await toPng(el, { backgroundColor: "#faf8f3", width: W, height: H, style: { width: `${W}px`, height: `${H}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` } });
    download(url, `${slug(state?.board.title ?? "board")}.png`);
  };
  const exportMd = () => {
    setExportOpen(false);
    if (!state) return;
    const md = toMarkdown(state.board, buildOutline(nodes, edges), lessonLabel);
    download(URL.createObjectURL(new Blob([md], { type: "text/markdown" })), `${slug(state.board.title)}.md`);
  };
  const exportPdf = () => {
    setExportOpen(false);
    setOutline(true);
    setTimeout(() => window.print(), 350);
  };

  if (board.missing)
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-lg font-semibold text-ink">This board doesn&apos;t exist (or isn&apos;t yours).</p>
        <Link href="/notes" className="mt-4 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white">
          {tr("myNotes")}
        </Link>
      </div>
    );
  if (!state) return <BoardSkeleton />;

  const menuNode = menu?.kind === "card" ? nodes.find((n) => n.id === menu.id) : undefined;
  const edgeObj = edges.find((e) => e.id === selEdge);
  const theme = lesson ? subjectStyle(lesson.subject.slug, lesson.subject.color) : undefined;
  const statusEl = (
    <span className="inline-flex min-w-0 items-center" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {status === "saving" ? (
          <motion.span key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1 text-xs whitespace-nowrap text-muted">
            <Loader2 className="size-3.5 animate-spin" aria-hidden /> {tr("saving")}
          </motion.span>
        ) : status === "offline" ? (
          <motion.span key="offline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1 text-xs text-tip">
            <CloudOff className="size-3.5 shrink-0" aria-hidden /> <span className="truncate">{tr("offline")}</span>
          </motion.span>
        ) : status === "local" ? (
          <motion.span key="local" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-muted">
            {tr("onThisDevice")}
          </motion.span>
        ) : justSaved ? (
          <motion.span key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.6 } }} className="inline-flex items-center gap-1 text-xs whitespace-nowrap text-good">
            <Check className="size-3.5" aria-hidden /> {tr("saved")}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );

  const iconBtn = "grid size-10 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:opacity-35";

  return (
    <BoardContext value={ctx}>
      <div style={theme} className={`notes-board fixed inset-x-0 top-14 bottom-0 z-20 flex flex-col overscroll-none bg-paper md:top-16 ${am ? "am" : ""}`}>
        {/* header */}
        <div className="relative z-30 flex items-center gap-1.5 border-b border-line bg-surface/95 px-2 py-1.5 backdrop-blur sm:gap-2 sm:px-3">
          <Link href="/notes" aria-label={tr("myNotes")} className={iconBtn}>
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <BoardIcon icon={state.board.emoji} colour={state.board.colour} size={30} className="!rounded-lg" />
              {rename ? (
                <input
                  autoFocus
                  defaultValue={state.board.title}
                  aria-label="Board name"
                  onBlur={(e) => {
                    setRename(false);
                    if (e.target.value.trim()) setBoard({ title: e.target.value.trim().slice(0, 120) });
                  }}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  className="min-w-0 flex-1 rounded-lg px-2 py-0.5 font-semibold ring-1 ring-line"
                />
              ) : (
                <button type="button" onClick={() => setRename(true)} className="truncate text-left font-semibold text-ink" title="Rename">
                  {state.board.title}
                </button>
              )}
              <span className="hidden sm:inline">{statusEl}</span>
            </div>
            {lesson && (
              <Link href={lesson.href} className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-ink" title={tr("backToLesson")}>
                <BookOpen className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{lessonLabel}</span>
              </Link>
            )}
          </div>
          <span className="sm:hidden">{statusEl}</span>
          <div className="relative hidden items-center md:flex">
            <Search className="pointer-events-none absolute left-2.5 size-4 text-faint" aria-hidden />
            <input
              ref={searchInput}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setMatchIdx(0);
              }}
              onKeyDown={(e) => e.key === "Enter" && goToMatch(matchIdx + 1)}
              placeholder="Search this board"
              aria-label="Search this board"
              className="h-9 w-44 rounded-full bg-ink/[0.05] pr-14 pl-8 text-sm lg:w-56"
            />
            {query && <span className="absolute right-3 text-xs text-muted tabular-nums">{matches.length ? `${(matchIdx % matches.length) + 1}/${matches.length}` : "0"}</span>}
          </div>
          <div className="hidden items-center md:flex">
            <button type="button" onClick={undo} disabled={!board.canUndo} aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" className={iconBtn}>
              <Undo2 className="size-[18px]" aria-hidden />
            </button>
            <button type="button" onClick={redo} disabled={!board.canRedo} aria-label="Redo (Ctrl+Shift+Z)" title="Redo (Ctrl+Shift+Z)" className={iconBtn}>
              <Redo2 className="size-[18px]" aria-hidden />
            </button>
            <button type="button" onClick={doTidy} aria-label="Tidy up (T)" title="Tidy up (T)" className={iconBtn}>
              <LayoutGrid className="size-[18px]" aria-hidden />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setOutline(!showOutline)}
            aria-pressed={showOutline}
            className={`hidden h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium sm:inline-flex ${showOutline ? "bg-accent text-white" : "text-muted hover:bg-ink/[0.06]"}`}
          >
            {showOutline ? <Spline className="size-4" aria-hidden /> : <List className="size-4" aria-hidden />}
            {showOutline ? "Board view" : "Outline"}
          </button>
          <Link href={`/notes/review?board=${state.board.id}`} className="hidden h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-muted hover:bg-ink/[0.06] sm:inline-flex">
            <Sparkles className="size-4" aria-hidden /> {tr("review")}
          </Link>
          <div className="relative">
            <button type="button" onClick={() => setAiOpen((o) => !o)} aria-expanded={aiOpen} aria-label="Rem AI" className={iconBtn} title="Rem AI">
              <Wand2 className="size-[18px]" aria-hidden />
            </button>
            <Dropdown open={aiOpen} onClose={() => setAiOpen(false)}>
              <MenuItem icon={FileText} label="Summarise this board" onClick={() => void runAi("summary")} />
              <MenuItem icon={Check} label="Check my notes" onClick={() => void runAi("check")} />
              <p className="px-3 pt-1 pb-2 text-[11px] text-faint">Uses your Rem questions. Rem never changes your notes.</p>
            </Dropdown>
          </div>
          <div className="relative">
            <button type="button" onClick={() => setExportOpen((o) => !o)} aria-expanded={exportOpen} aria-label="Export" className={iconBtn} title="Export">
              <Download className="size-[18px]" aria-hidden />
            </button>
            <Dropdown open={exportOpen} onClose={() => setExportOpen(false)}>
              <MenuItem icon={ImageIcon} label="PNG image" onClick={() => void exportPng()} />
              <MenuItem icon={FileText} label="PDF (outline)" onClick={exportPdf} />
              <MenuItem icon={Download} label="Markdown" onClick={exportMd} />
              <hr className="my-1 border-line" />
              <MenuItem
                icon={Trash2}
                label={tr("deleteBoard")}
                danger
                onClick={async () => {
                  await softDeleteBoard(state.board, loggedIn);
                  router.push("/notes");
                }}
              />
            </Dropdown>
          </div>
          <button type="button" onClick={() => setHelp((h) => !h)} aria-label="Keyboard shortcuts (?)" className={`${iconBtn} hidden md:grid`}>
            <HelpCircle className="size-[18px]" aria-hidden />
          </button>
        </div>
        {!loggedIn && !userLoading && (
          <p className="border-b border-line bg-tip-soft px-4 py-1.5 text-center text-xs text-tip">
            {tr("loginToKeepNotes")}{" "}
            <Link href="/login?next=/notes" className="font-semibold underline">
              {tr("login")}
            </Link>
          </p>
        )}

        {/* canvas or outline (isolated: card layers never cover the header menus) */}
        <div className="relative isolate z-0 min-h-0 flex-1">
          {showOutline ? (
            <div className="absolute inset-0 overflow-y-auto pb-20 md:pb-0">
              <OutlineView
                nodes={nodes}
                edges={edges}
                title={state.board.title}
                lessonLabel={lessonLabel}
                onOpen={(id) => {
                  setOutline(false);
                  setSelected(new Set([id]));
                  setTimeout(() => void rf.fitView({ nodes: [{ id }], duration: 500, maxZoom: 1.2, padding: 0.6 }), 120);
                }}
              />
            </div>
          ) : (
            <div
              ref={canvasRef}
              className={`absolute inset-0 touch-none ${tidying ? "notes-tidying" : ""}`}
              onPointerDown={onPointerDown}
              onPointerMove={cancelPress}
              onPointerUp={() => cancelPress()}
              onPointerCancel={() => cancelPress()}
            >
              {canvasReady && (
              <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeDragStart={(_, __, dragged) => {
                  dragStart.current = new Map(dragged.map((d) => [d.id, { ...d.position }]));
                  for (const f of framesOf(new Set(dragged.map((d) => d.id)))) for (const ch of childrenOf(f)) dragStart.current.set(ch.id, { x: ch.x, y: ch.y });
                }}
                onNodeDragStop={() => commitOverride(override)}
                onConnect={(c: Connection) => c.source && c.target && connect(c.source, c.target)}
                onNodeClick={(_, n) => {
                  if (connectFrom) {
                    connect(connectFrom, n.id);
                    setConnectFrom(null);
                  }
                }}
                onEdgeClick={(_, e) => setSelEdge(e.id)}
                onPaneClick={() => {
                  setSelected(new Set());
                  setSelEdge(null);
                  setEditing(null);
                  setMenu(null);
                  setConnectFrom(null);
                }}
                onNodeContextMenu={(e, n) => {
                  e.preventDefault();
                  setMenu({ kind: "card", id: n.id, x: e.clientX, y: e.clientY });
                }}
                onPaneContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ kind: "add", x: e.clientX, y: e.clientY, at: rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }) });
                }}
                onMoveEnd={onMoveEnd}
                onInit={() => {
                  // Opening a board shows ALL its cards (unless the search sent us to one card: ?card=…).
                  if (!new URLSearchParams(window.location.search).get("card")) fitAll(0);
                }}
                onError={(code, message) => {
                  // 004 = the container has no size for a moment (page reload / closing); harmless.
                  if (code !== "004") console.warn(message);
                }}
                defaultViewport={state.board.viewport ?? undefined}
                minZoom={0.1}
                maxZoom={2.5}
                snapToGrid
                snapGrid={[20, 20]}
                connectionMode={ConnectionMode.Loose}
                connectionRadius={36}
                deleteKeyCode={null}
                selectionKeyCode="Shift"
                multiSelectionKeyCode={["Shift", "Meta", "Control"]}
                selectionOnDrag={phone ? selectMode : false}
                panOnDrag={phone ? !selectMode : true}
                zoomOnDoubleClick={false}
                onlyRenderVisibleElements
                elevateNodesOnSelect={false}
                proOptions={{ hideAttribution: false }}
                aria-label="Notes board"
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1.4} color="#cfc8b8" />
                <Controls showInteractive={false} showFitView={false} position="bottom-right" className="!mb-20 !shadow-none md:!mb-4">
                  <ControlButton onClick={() => fitAll()} title="Fit to screen (F)" aria-label="Fit to screen">
                    <Maximize className="!max-h-3 !max-w-3" aria-hidden />
                  </ControlButton>
                </Controls>
                {!phone && <MiniMap pannable zoomable nodeColor={(n) => COLOR_BG[((n.data as { node: BoardNode }).node.data.color ?? "white") as CardColor] ?? "#fff"} nodeStrokeColor="#d9d3c5" className="!rounded-xl !border !border-line" />}
                <ViewportPortal>
                  {guides.map((g, i) => (
                    <div
                      key={i}
                      className="pointer-events-none absolute bg-[#e11d48]"
                      style={g.axis === "x" ? { left: g.at, top: -5000, width: 1, height: 10000 } : { top: g.at, left: -5000, height: 1, width: 10000 }}
                    />
                  ))}
                </ViewportPortal>
              </ReactFlow>
              )}
              {!nodes.length && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted">
                  <p>
                    Tap <strong>+ Add</strong> to put your first card on the board.
                    <br />
                    {phone ? "Long-press the paper to add a card right there." : "Right-click the paper to add a card right there."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* connect mode hint */}
          <AnimatePresence>
            {connectFrom && (
              <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute top-3 left-1/2 z-30 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg">
                Now tap the card to connect to ·{" "}
                <button type="button" className="underline" onClick={() => setConnectFrom(null)}>
                  cancel
                </button>
              </motion.p>
            )}
          </AnimatePresence>

          {/* edge editor */}
          <AnimatePresence>
            {edgeObj && !showOutline && (
              <motion.div
                key="edge"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={spring}
                className="absolute bottom-24 left-1/2 z-30 flex w-[min(92vw,420px)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-2xl bg-surface p-2.5 shadow-[0_12px_32px_-12px_rgba(29,42,44,0.4)] ring-1 ring-line md:bottom-6"
                role="dialog"
                aria-label="Arrow"
              >
                <input
                  key={edgeObj.id}
                  defaultValue={edgeObj.label ?? ""}
                  placeholder="Label, e.g. causes"
                  aria-label="Arrow label"
                  maxLength={80}
                  onBlur={(e) => setContent((c) => ({ ...c, edges: c.edges.map((x) => (x.id === edgeObj.id ? { ...x, label: e.target.value, updated_at: now() } : x)) }))}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  className="h-10 min-w-0 flex-1 rounded-xl bg-ink/[0.05] px-3 text-sm"
                />
                {EDGE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Colour ${c}`}
                    onClick={() => setContent((s) => ({ ...s, edges: s.edges.map((x) => (x.id === edgeObj.id ? { ...x, style: { ...x.style, color: c }, updated_at: now() } : x)) }))}
                    className={`size-7 rounded-full ${edgeObj.style?.color === c ? "ring-2 ring-ink/50 ring-offset-2" : ""}`}
                    style={{ background: c }}
                  />
                ))}
                <button
                  type="button"
                  aria-pressed={!!edgeObj.style?.dashed}
                  onClick={() => setContent((s) => ({ ...s, edges: s.edges.map((x) => (x.id === edgeObj.id ? { ...x, style: { ...x.style, dashed: !x.style?.dashed }, updated_at: now() } : x)) }))}
                  className={`h-9 rounded-xl px-3 text-sm ${edgeObj.style?.dashed ? "bg-accent text-white" : "bg-ink/[0.05] text-ink"}`}
                >
                  dashed
                </button>
                <button
                  type="button"
                  aria-label="Delete arrow"
                  onClick={() => {
                    setContent((s) => ({ ...s, edges: s.edges.filter((x) => x.id !== edgeObj.id) }));
                    setSelEdge(null);
                  }}
                  className="grid size-9 place-items-center rounded-xl text-bad hover:bg-bad-soft"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* + Add (desktop: floating; phone: in the bottom toolbar) */}
          {!showOutline && !phone && (
            <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setMenu(menu?.kind === "add" ? null : { kind: "add", x: r.left + r.width / 2, y: r.top });
                }}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 font-medium text-white shadow-[0_10px_26px_-10px_rgba(29,42,44,0.5)]"
              >
                <Plus className="size-5" aria-hidden /> Add
              </motion.button>
            </div>
          )}

          {/* phone toolbar */}
          {phone && (
            <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-around border-t border-line bg-surface/95 px-1 pt-1 pb-[calc(0.35rem+env(safe-area-inset-bottom))] backdrop-blur">
              <PhoneTool icon={Plus} label="Add" onClick={() => setMenu(menu?.kind === "add" ? null : { kind: "add", x: window.innerWidth / 2, y: window.innerHeight - 80 })} active={menu?.kind === "add"} />
              <PhoneTool icon={MousePointer2} label="Select" active={selectMode} onClick={() => setSelectMode((s) => !s)} />
              <PhoneTool
                icon={Spline}
                label="Connect"
                active={!!connectFrom}
                onClick={() => (selected.size === 1 ? setConnectFrom([...selected][0]!) : say("Select a card first, then Connect"))}
              />
              <PhoneTool icon={LayoutGrid} label="Tidy" onClick={doTidy} />
              <PhoneTool icon={showOutline ? Spline : List} label={showOutline ? "Board" : "Outline"} active={showOutline} onClick={() => setOutline(!showOutline)} />
              <PhoneTool icon={Undo2} label="Undo" onClick={undo} disabled={!board.canUndo} />
            </div>
          )}
        </div>

        {/* menus */}
        <AnimatePresence>
          {menu?.kind === "add" && (
            <FloatingMenu key="add" x={menu.x} y={menu.y} up={!menu.at} onClose={() => setMenu(null)} label="Add a card">
              <div className="grid grid-cols-2 gap-1 sm:w-[300px]">
                {ADD_ITEMS.map((it) => (
                  <button
                    key={it.type}
                    type="button"
                    onClick={() => addCard(it.type, menu.at)}
                    className="flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink hover:bg-ink/[0.05]"
                  >
                    <it.Icon className="size-4 text-accent" aria-hidden />
                    {it.label}
                  </button>
                ))}
              </div>
            </FloatingMenu>
          )}
          {menu?.kind === "card" && menuNode && (
            <FloatingMenu key="card" x={menu.x} y={menu.y} onClose={() => setMenu(null)} label="Card">
              <div className="w-56">
                <MenuItem
                  icon={PenLine}
                  label="Edit"
                  onClick={() => {
                    setMenu(null);
                    if (menuNode.type === "drawing") setDrawingId(menuNode.id);
                    else setEditing(menuNode.id);
                  }}
                />
                {menuNode.type !== "image" && menuNode.type !== "drawing" && menuNode.type !== "frame" && (
                  <div className="flex gap-1.5 px-3 py-2" role="group" aria-label="Colour">
                    {CARD_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Colour ${c}`}
                        onClick={() => update(menuNode.id, { color: c })}
                        className={`size-7 rounded-full ring-1 ring-line ${menuNode.data.color === c ? "ring-2 ring-ink/50" : ""}`}
                        style={{ background: COLOR_BG[c] }}
                      />
                    ))}
                  </div>
                )}
                <MenuItem
                  icon={Spline}
                  label="Connect…"
                  onClick={() => {
                    setConnectFrom(menuNode.id);
                    setMenu(null);
                  }}
                />
                <MenuItem
                  icon={Copy}
                  label="Duplicate"
                  onClick={() => {
                    duplicate(new Set([menuNode.id]));
                    setMenu(null);
                  }}
                />
                {menuNode.type !== "frame" && menuNode.type !== "image" && menuNode.type !== "drawing" && (
                  <>
                    <MenuItem
                      icon={Sparkles}
                      label={flashIds.has(menuNode.id) ? "Flashcard ✓" : "Make flashcard"}
                      onClick={() => {
                        makeFlashcard(menuNode);
                        setMenu(null);
                      }}
                    />
                    <MenuItem icon={Wand2} label="AI: flashcards from this card" onClick={() => void runAi("flashcards", menuNode)} />
                  </>
                )}
                <MenuItem
                  icon={Trash2}
                  label="Delete"
                  danger
                  onClick={() => {
                    removeNodes(new Set([menuNode.id]));
                    setMenu(null);
                  }}
                />
              </div>
            </FloatingMenu>
          )}
        </AnimatePresence>

        {/* phone: full-screen editor for note / sticky cards (portal: above the site header) */}
        <OnBody>
        <AnimatePresence>
          {phone && editingId && (() => {
            const n = nodes.find((x) => x.id === editingId);
            if (!n || (n.type !== "note" && n.type !== "sticky")) return null;
            return (
              <motion.div key="sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={spring} className="fixed inset-0 z-[60] flex flex-col bg-surface p-4 pt-[calc(1rem+env(safe-area-inset-top))]" role="dialog" aria-label="Edit card">
                <TextEditor n={n} big />
              </motion.div>
            );
          })()}
        </AnimatePresence>

        </OnBody>

        {/* flashcard: edit the front / back before saving */}
        <OnBody>
          <AnimatePresence>
            {flashDraft && <FlashcardDialog key={flashDraft.id} draft={flashDraft} onCancel={() => setFlashDraft(null)} onSave={saveFlash} />}
          </AnimatePresence>
        </OnBody>

        {/* drawing editor */}
        <OnBody>
        <AnimatePresence>
          {drawingId && (() => {
            const n = nodes.find((x) => x.id === drawingId);
            if (!n) return null;
            return (
              <DrawingSheet
                key={drawingId}
                initial={(n.data.drawing as InkDoc) ?? null}
                onDone={(doc) => {
                  update(n.id, { drawing: doc });
                  setDrawingId(null);
                }}
              />
            );
          })()}
        </AnimatePresence>
        </OnBody>

        {/* AI results */}
        <AnimatePresence>
          {ai && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={spring}
              className="fixed right-3 bottom-24 z-40 w-[min(92vw,380px)] rounded-2xl bg-surface p-4 shadow-[0_16px_40px_-14px_rgba(29,42,44,0.45)] ring-1 ring-line md:top-32 md:bottom-auto"
              role="dialog"
              aria-label="Rem AI"
            >
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="size-4 text-accent" aria-hidden />
                <p className="flex-1 text-sm font-semibold text-ink">
                  {ai.mode === "summary" ? "Summary" : ai.mode === "check" ? "Rem checked your notes" : "Flashcards from this card"}
                </p>
                <button type="button" aria-label="Close" onClick={() => setAi(null)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-ink/[0.06]">
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              {ai.loading && (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Rem is reading your notes…
                </p>
              )}
              {ai.error && <p className="text-sm text-bad">{ai.error}</p>}
              {ai.text && (
                <>
                  <div className="max-h-72 overflow-y-auto text-sm leading-relaxed text-ink/90 whitespace-pre-line">{ai.text}</div>
                  <button
                    type="button"
                    onClick={() => {
                      addCard("note", undefined, { title: ai.mode === "summary" ? "Summary" : "Rem's check", body: ai.text, color: ai.mode === "summary" ? "green" : "blue" });
                      setEditing(null);
                      setAi(null);
                    }}
                    className="mt-3 h-10 w-full rounded-full bg-accent text-sm font-medium text-white"
                  >
                    Add as a card
                  </button>
                </>
              )}
              {ai.cards && (
                <>
                  <ul className="max-h-72 space-y-2 overflow-y-auto">
                    {ai.cards.map((c, i) => (
                      <li key={i} className="flex gap-2 rounded-xl bg-paper p-2.5 text-sm">
                        <input
                          type="checkbox"
                          checked={c.keep}
                          aria-label="Keep this flashcard"
                          onChange={() => setAi({ ...ai, cards: ai.cards!.map((x, k) => (k === i ? { ...x, keep: !x.keep } : x)) })}
                          className="mt-1 accent-[var(--accent)]"
                        />
                        <span>
                          <span className="font-semibold text-ink">{c.front}</span>
                          <span className="block text-muted">{c.back}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={async () => {
                      const src = nodes.find((n) => n.id === ai.from);
                      let i = 0;
                      for (const c of ai.cards!.filter((x) => x.keep)) {
                        const n = addCard("note", src ? { x: src.x + src.w + 160 + (i % 2) * 280, y: src.y + Math.floor(i / 2) * 200 + 80 } : undefined, { title: c.front, body: c.back, color: "blue" });
                        setEditing(null);
                        await saveFlashcard(boardId, n.id, c.front, c.back, loggedIn, !!state.board.local).catch(() => {});
                        setFlashIds((s) => new Set(s).add(n.id));
                        if (src) connect(src.id, n.id);
                        i++;
                      }
                      notifyDue();
                      setSelEdge(null);
                      setAi(null);
                      say(`${i} flashcards added`);
                    }}
                    className="mt-3 h-10 w-full rounded-full bg-accent text-sm font-medium text-white"
                  >
                    Add the chosen flashcards
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* help */}
        <AnimatePresence>
          {help && (
            <motion.div key="help" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-ink/25 p-4" onClick={() => setHelp(false)}>
              <div role="dialog" aria-label="Keyboard shortcuts" className="w-full max-w-md rounded-3xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <p className="mb-3 text-lg font-semibold text-ink">Shortcuts</p>
                <ul className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  {[
                    ["N / S", "New note / sticky"],
                    ["Double-click", "Edit a card"],
                    ["Enter", "Edit the selected card"],
                    ["Shift + drag", "Select several cards"],
                    ["Drag an edge dot", "Connect two cards"],
                    ["Delete", "Delete the selection"],
                    ["Ctrl + D", "Duplicate"],
                    ["Ctrl + C / V", "Copy / paste (also between boards)"],
                    ["Ctrl + Z / Shift + Z", "Undo / redo"],
                    ["Ctrl + F", "Search"],
                    ["T", "Tidy up"],
                    ["O", "Outline view"],
                    ["F", "Fit to screen"],
                    ["Right-click", "Add here / card menu"],
                  ].map(([k, v]) => (
                    <li key={k} className="contents">
                      <kbd className="rounded-md bg-ink/[0.06] px-2 py-0.5 font-mono text-[12px] text-ink">{k}</kbd>
                      <span className="text-muted">{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {toast && (
            <motion.p key="toast" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg md:bottom-24" role="status">
              {toast}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </BoardContext>
  );
}

/* ------------------------------------------------------------------ small parts */

function FlashcardDialog({
  draft,
  onCancel,
  onSave,
}: {
  draft: { id: string; front: string; back: string };
  onCancel: () => void;
  onSave: (d: { id: string; front: string; back: string }) => Promise<void>;
}) {
  const [front, setFront] = useState(draft.front);
  const [back, setBack] = useState(draft.back);
  const [busy, setBusy] = useState(false);
  const ok = front.trim().length > 0 && back.trim().length > 0 && !busy;
  const field = "w-full rounded-xl bg-paper px-3 py-2 text-[15px] text-ink ring-1 ring-line focus:ring-2 focus:ring-accent/50";
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/30 sm:items-center sm:p-4"
      onClick={onCancel}
    >
      <motion.form
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={spring}
        role="dialog"
        aria-modal="true"
        aria-label="Make a flashcard"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation(); // the board's shortcuts don't fire while typing
          if (e.key === "Escape") onCancel();
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ok) return;
          setBusy(true);
          await onSave({ id: draft.id, front, back });
          setBusy(false);
        }}
        className="w-full max-w-md space-y-3 rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_16px_40px_-14px_rgba(29,42,44,0.45)] sm:rounded-3xl"
      >
        <p className="text-base font-semibold text-ink">Make a flashcard</p>
        <label className="block text-sm font-medium text-muted">
          Front (question)
          <textarea autoFocus rows={2} value={front} maxLength={500} onChange={(e) => setFront(e.target.value)} className={`mt-1 resize-none ${field}`} />
        </label>
        <label className="block text-sm font-medium text-muted">
          Back (answer)
          <textarea rows={5} value={back} maxLength={4000} onChange={(e) => setBack(e.target.value)} className={`mt-1 resize-y ${field}`} />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} className="h-10 rounded-full px-4 text-sm font-medium text-muted hover:bg-ink/[0.05]">
            Cancel
          </button>
          <button type="submit" disabled={!ok} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-5 text-sm font-medium text-white disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />} Save flashcard
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

/** Full-screen sheets go to <body> so the site header (z-30, above the board) never covers their top. */
function OnBody({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

function DrawingSheet({ initial, onDone }: { initial: InkDoc | null; onDone: (d: InkDoc) => void }) {
  const api = useInkDoc(null, initial);
  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={spring} className="fixed inset-0 z-[60] flex flex-col bg-surface pt-[env(safe-area-inset-top)]" role="dialog" aria-label="Drawing">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <p className="flex-1 pl-1 text-sm font-semibold text-ink">Drawing</p>
        <button type="button" onClick={() => onDone(api.doc)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-5 text-sm font-medium text-white">
          <Check className="size-4" aria-hidden /> Done
        </button>
      </div>
      <InkEditor api={api} className="min-h-0 flex-1" ariaLabel="Drawing card" />
    </motion.div>
  );
}

function Dropdown({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !(e.target as HTMLElement).closest("[data-dropdown]") && onClose();
    setTimeout(() => document.addEventListener("click", h), 0);
    return () => document.removeEventListener("click", h);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-dropdown
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={spring}
          className="absolute top-11 right-0 z-50 w-56 rounded-2xl bg-surface p-1 shadow-[0_14px_36px_-14px_rgba(29,42,44,0.45)] ring-1 ring-line"
          role="menu"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Plus; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm ${danger ? "text-bad hover:bg-bad-soft" : "text-ink hover:bg-ink/[0.05]"}`}>
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </button>
  );
}

function FloatingMenu({ x, y, up, onClose, label, children }: { x: number; y: number; up?: boolean; onClose: () => void; label: string; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: PointerEvent) => !(e.target as HTMLElement).closest("[data-floating-menu]") && onClose();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const id = setTimeout(() => document.addEventListener("pointerdown", h), 0);
    document.addEventListener("keydown", k);
    return () => {
      clearTimeout(id);
      document.removeEventListener("pointerdown", h);
      document.removeEventListener("keydown", k);
    };
  }, [onClose]);
  const left = Math.max(8, Math.min(x - 150, (typeof window !== "undefined" ? window.innerWidth : 800) - 316));
  return (
    <motion.div
      data-floating-menu
      role="menu"
      aria-label={label}
      initial={{ opacity: 0, scale: 0.96, y: up ? 6 : -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={spring}
      className="fixed z-[55] rounded-2xl bg-surface p-1.5 shadow-[0_16px_40px_-14px_rgba(29,42,44,0.45)] ring-1 ring-line"
      style={up ? { left, bottom: Math.max(8, (typeof window !== "undefined" ? window.innerHeight : 800) - y + 10) } : { left, top: Math.min(y, (typeof window !== "undefined" ? window.innerHeight : 800) - 360) }}
    >
      {children}
    </motion.div>
  );
}

function PhoneTool({ icon: Icon, label, onClick, active, disabled }: { icon: typeof Plus; label: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex min-h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-[11px] font-medium disabled:opacity-35 ${active ? "bg-accent-soft text-accent-ink" : "text-muted"}`}
    >
      <Icon className="size-5" aria-hidden />
      {label}
    </button>
  );
}

export function BoardSkeleton() {
  return (
    <div className="fixed inset-x-0 top-14 bottom-0 z-20 bg-paper md:top-16" aria-busy="true">
      <div className="flex h-14 items-center gap-3 border-b border-line bg-surface px-3">
        <div className="skeleton size-9 rounded-xl" />
        <div className="skeleton h-5 w-48" />
      </div>
      <div className="relative h-full">
        {[
          [80, 60, 240, 150],
          [420, 120, 220, 170],
          [200, 320, 260, 140],
        ].map(([x, y, w, h], i) => (
          <div key={i} className="skeleton absolute rounded-2xl" style={{ left: x, top: y, width: w, height: h }} />
        ))}
      </div>
    </div>
  );
}

function download(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9ሀ-፿]+/g, "-").replace(/^-|-$/g, "") || "board";

export { ChevronDown };
