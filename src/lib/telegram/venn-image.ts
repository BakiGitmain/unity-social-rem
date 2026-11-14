/**
 * Draws a VennSpec as a PNG on the server (next/og: Satori + Resvg, bundled font, works on Vercel).
 * Shapes are an SVG <img> (shading = nested clip paths + a mask for "outside these circles"); letters, region
 * numbers and elements are text on top, so they use the bundled font. No JSX, so plain Node can run it too.
 */
import { createElement as h, type ReactElement } from "react";
import { ImageResponse } from "next/og";
import { REGIONS } from "../math/venn.ts";
import { VENN_LAYOUT, allDrawable, regionNumber, type VennSpec } from "./venn.ts";

const COLORS = ["#2563c9", "#0f766e", "#c2410c"]; // circle 1 blue, 2 teal, 3 orange (no purple)
const SHADE = "#facc15";
const INK = "#0f172a";
const CANON = ["A", "B", "C"];

function svg(spec: VennSpec): string {
  const L = VENN_LAYOUT[spec.size];
  const { width: W, height: H, r } = L;
  const circle = (i: number, extra: string) => `<circle cx="${L.centers[i]![0]}" cy="${L.centers[i]![1]}" r="${r}" ${extra}/>`;
  const defs = L.centers.map((_, i) => `<clipPath id="c${i}">${circle(i, "")}</clipPath>`);
  const box = `x="16" y="16" width="${W - 32}" height="${H - 32}"`;
  const shaded = spec.shaded.map((region, k) => {
    const inside = region === "none" ? [] : [...region].map((c) => CANON.indexOf(c));
    const outside = L.centers.map((_, i) => i).filter((i) => !inside.includes(i));
    if (outside.length) defs.push(`<mask id="m${k}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="white"/>${outside.map((i) => circle(i, 'fill="black"')).join("")}</mask>`);
    let shape = `<rect ${box} rx="14" fill="${SHADE}" fill-opacity="0.7"${outside.length ? ` mask="url(#m${k})"` : ""}/>`;
    for (const i of inside) shape = `<g clip-path="url(#c${i})">${shape}</g>`;
    return shape;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<defs>${defs.join("")}</defs>`,
    `<rect width="${W}" height="${H}" fill="#ffffff"/>`,
    `<rect ${box} rx="14" fill="#fbfaf7"/>`,
    ...L.centers.map((_, i) => circle(i, `fill="${COLORS[i]}" fill-opacity="0.07"`)),
    ...shaded,
    ...L.centers.map((_, i) => circle(i, `fill="none" stroke="${COLORS[i]}" stroke-width="4"`)),
    `<rect ${box} rx="14" fill="none" stroke="#334155" stroke-width="3"/>`,
    `</svg>`,
  ].join("");
}

const abs = (left: number, top: number, style: Record<string, string | number> = {}) => ({ position: "absolute" as const, left, top, display: "flex", ...style });

/** PNG bytes of the diagram. */
export async function renderVennPng(spec: VennSpec): Promise<Uint8Array> {
  const L = VENN_LAYOUT[spec.size];
  const big = spec.size === 2;
  const showElements = allDrawable(spec);
  const kids: ReactElement[] = [
    h("img", { key: "shapes", src: `data:image/svg+xml;base64,${Buffer.from(svg(spec)).toString("base64")}`, width: L.width, height: L.height, style: abs(0, 0) }),
    h("div", { key: "U", style: abs(30, 24, { fontSize: 30, color: "#334155" }) }, "U"),
  ];
  spec.labels.forEach((label, i) => {
    const [x, y] = L.labelAt[i]!;
    kids.push(h("div", { key: `l${i}`, style: abs(x - 22, y - 26, { width: 44, justifyContent: "center", fontSize: 44, color: COLORS[i]! }) }, label));
  });
  for (const region of REGIONS[spec.size]) {
    const { at, w } = L.regions[region]!;
    const [x, y] = at;
    const items = showElements ? (spec.elements[region] ?? []) : [];
    const text = items.length > 6 ? `${items.slice(0, 6).join(", ")}, …` : items.join(", ");
    const badgeY = text && region !== "none" ? y - 28 : y;
    const d = big ? 34 : 30;
    kids.push(
      h(
        "div",
        { key: `n${region}`, style: abs(x - d / 2, badgeY - d / 2, { width: d, height: d, borderRadius: d / 2, background: "#1e293b", color: "#ffffff", fontSize: big ? 20 : 18, alignItems: "center", justifyContent: "center" }) },
        String(regionNumber(spec.size, region)),
      ),
    );
    if (!text) continue;
    const fontSize = big ? 21 : 18;
    kids.push(
      region === "none"
        ? h("div", { key: `e${region}`, style: abs(x + d / 2 + 8, y - fontSize * 0.65, { width: w, fontSize, color: INK }) }, text)
        : h("div", { key: `e${region}`, style: abs(x - w / 2, y - 6, { width: w, justifyContent: "center", textAlign: "center", fontSize, lineHeight: 1.15, color: INK }) }, text),
    );
  }
  const root = h("div", { style: { width: L.width, height: L.height, display: "flex", position: "relative", background: "#ffffff" } }, ...kids);
  const res = new ImageResponse(root, { width: L.width, height: L.height });
  return new Uint8Array(await res.arrayBuffer());
}
