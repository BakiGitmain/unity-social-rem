"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, Download, Search, X } from "lucide-react";
import { Button, EmptyState, Select } from "@/components/admin/ui";

export type Column<T> = {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Value used for sorting (omit = not sortable). */
  sort?: (row: T) => string | number | null | undefined;
  /** Value written to CSV (defaults to sort value). */
  csv?: (row: T) => string | number | null | undefined;
  /** Text included in the search. */
  search?: (row: T) => string;
  hidden?: boolean;
  className?: string;
};

export type Filter<T> = {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  test: (row: T, value: string) => boolean;
};

function toCsv<T>(rows: T[], columns: Column<T>[]) {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    // Neutralise spreadsheet formulas, quote everything.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const cols = columns.filter((c) => c.csv || c.sort);
  return [cols.map((c) => esc(c.header)).join(","), ...rows.map((r) => cols.map((c) => esc((c.csv ?? c.sort)!(r))).join(","))].join("\n");
}

/**
 * Everything a small admin table needs, client-side (the class is small): search, filters, sorting,
 * pagination, column visibility, row selection with bulk actions, and CSV export of the filtered rows.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  filters = [],
  searchPlaceholder = "Search…",
  bulkActions,
  csvName,
  onRowClick,
  empty,
  initialSort,
  pageSize: initialPageSize = 25,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  filters?: Filter<T>[];
  searchPlaceholder?: string;
  bulkActions?: (selected: T[], clear: () => void) => React.ReactNode;
  csvName?: string;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  initialSort?: { id: string; dir: "asc" | "desc" };
  pageSize?: number;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Record<string, string>>({});
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [hidden, setHidden] = useState<string[]>(() => columns.filter((c) => c.hidden).map((c) => c.id));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [colsOpen, setColsOpen] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!colsOpen) return;
    const off = (e: PointerEvent) => !colsRef.current?.contains(e.target as Node) && setColsOpen(false);
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [colsOpen]);

  const visible = columns.filter((c) => !hidden.includes(c.id));

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) =>
      filters.every((f) => !active[f.id] || f.test(r, active[f.id]!)),
    );
    if (needle) {
      out = out.filter((r) =>
        columns.some((c) => {
          const v = c.search ? c.search(r) : c.sort ? c.sort(r) : null;
          return v !== null && v !== undefined && String(v).toLowerCase().includes(needle);
        }),
      );
    }
    if (sort) {
      const col = columns.find((c) => c.id === sort.id);
      if (col?.sort) {
        out = [...out].sort((a, b) => {
          const x = col.sort!(a);
          const y = col.sort!(b);
          if (x === y) return 0;
          if (x === null || x === undefined) return 1;
          if (y === null || y === undefined) return -1;
          const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
          return sort.dir === "asc" ? r : -r;
        });
      }
    }
    return out;
  }, [rows, q, active, sort, columns, filters]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const shown = filtered.slice(current * pageSize, current * pageSize + pageSize);
  const selectedRows = rows.filter((r) => selected.has(rowKey(r)));
  const allShownSelected = shown.length > 0 && shown.every((r) => selected.has(rowKey(r)));

  const toggle = (k: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const exportCsv = () => {
    const blob = new Blob(["﻿" + toCsv(filtered, visible)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${csvName ?? "export"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      {/* toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-10 w-full rounded-full bg-paper pr-9 pl-9 text-sm ring-1 ring-line transition-shadow placeholder:text-faint focus:bg-surface focus:ring-2 focus:ring-accent/40"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-faint hover:text-ink">
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </label>
        {filters.map((f) => (
          <Select
            key={f.id}
            aria-label={f.label}
            value={active[f.id] ?? ""}
            onChange={(e) => {
              setActive((a) => ({ ...a, [f.id]: e.target.value }));
              setPage(0);
            }}
            className="!h-10 !w-auto !rounded-full"
          >
            <option value="">{f.label}: all</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        ))}
        <div ref={colsRef} className="relative">
          <Button size="md" icon={<Columns3 className="size-4" aria-hidden />} onClick={() => setColsOpen((o) => !o)} aria-expanded={colsOpen}>
            <span className="hidden sm:inline">Columns</span>
          </Button>
          <AnimatePresence>
            {colsOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 500, damping: 34 }}
                style={{ transformOrigin: "top right" }}
                className="absolute top-full right-0 z-30 mt-2 w-52 rounded-2xl bg-surface p-2 shadow-[0_14px_36px_-14px_rgba(29,42,44,0.35)] ring-1 ring-line"
              >
                {columns.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-paper">
                    <input
                      type="checkbox"
                      className="accent-[var(--accent)]"
                      checked={!hidden.includes(c.id)}
                      onChange={() => setHidden((h) => (h.includes(c.id) ? h.filter((x) => x !== c.id) : [...h, c.id]))}
                    />
                    {c.header || c.id}
                  </label>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {csvName && (
          <Button icon={<Download className="size-4" aria-hidden />} onClick={exportCsv}>
            <span className="hidden sm:inline">CSV</span>
          </Button>
        )}
      </div>

      {/* bulk bar */}
      <AnimatePresence>
        {bulkActions && selectedRows.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-accent-soft px-3 py-2 text-sm">
              <span className="font-medium text-accent-ink">{selectedRows.length} selected</span>
              <div className="flex flex-wrap gap-2">{bulkActions(selectedRows, () => setSelected(new Set()))}</div>
              <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-[13px] text-accent-ink underline-offset-2 hover:underline">
                Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* table */}
      <div className="overflow-x-auto rounded-2xl ring-1 ring-line">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead className="bg-paper text-[12px] font-semibold tracking-wide text-muted uppercase">
            <tr>
              {bulkActions && (
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    className="accent-[var(--accent)]"
                    checked={allShownSelected}
                    onChange={() =>
                      setSelected((s) => {
                        const n = new Set(s);
                        shown.forEach((r) => (allShownSelected ? n.delete(rowKey(r)) : n.add(rowKey(r))));
                        return n;
                      })
                    }
                  />
                </th>
              )}
              {visible.map((c) => (
                <th key={c.id} className={`px-3 py-2.5 whitespace-nowrap ${c.className ?? ""}`} aria-sort={sort?.id === c.id ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                  {c.sort ? (
                    <button
                      type="button"
                      onClick={() => setSort((s) => (s?.id === c.id ? (s.dir === "asc" ? { id: c.id, dir: "desc" } : null) : { id: c.id, dir: "asc" }))}
                      className="inline-flex items-center gap-1 uppercase hover:text-ink"
                    >
                      {c.header}
                      {sort?.id === c.id && (sort.dir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-surface">
            {/* Rows fade/slide out when deleted and slide into place when the list changes. */}
            <AnimatePresence initial={false}>
            {shown.map((r) => {
              const k = rowKey(r);
              return (
                <motion.tr
                  key={k}
                  data-row-key={k}
                  layout="position"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -24, transition: { duration: 0.22, ease: "easeIn" } }}
                  transition={{ type: "spring", stiffness: 420, damping: 38 }}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={`border-t border-line transition-colors ${onRowClick ? "cursor-pointer hover:bg-[var(--accent-tint)]" : ""} ${selected.has(k) ? "bg-accent-soft/40" : ""}`}
                >
                  {bulkActions && (
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label="Select row" className="accent-[var(--accent)]" checked={selected.has(k)} onChange={() => toggle(k)} />
                    </td>
                  )}
                  {visible.map((c) => (
                    <td key={c.id} className={`px-3 py-2.5 align-middle ${c.className ?? ""}`}>
                      {c.cell(r)}
                    </td>
                  ))}
                </motion.tr>
              );
            })}
            </AnimatePresence>
          </tbody>
        </table>
        {shown.length === 0 && <div className="border-t border-line bg-surface">{empty ?? <EmptyState title="Nothing here" text={q ? "No results for this search." : undefined} />}</div>}
      </div>

      {/* pagination */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <span>
          {filtered.length === 0 ? "0" : `${current * pageSize + 1}–${Math.min(filtered.length, (current + 1) * pageSize)}`} of {filtered.length}
        </span>
        <div className="flex items-center gap-2">
          <Select aria-label="Rows per page" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} className="!h-8 !w-auto !rounded-full !text-[13px]">
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </Select>
          <Button size="sm" variant="ghost" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)} icon={<ChevronLeft className="size-4" aria-hidden />} />
          <span className="tabular-nums">
            {current + 1} / {pages}
          </span>
          <Button size="sm" variant="ghost" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} icon={<ChevronRight className="size-4" aria-hidden />} />
        </div>
      </div>
    </div>
  );
}
