/**
 * Board templates: a ready layout of cards (and arrows) to start from. Pure (tested via outline).
 */
import { CARD_SIZE, now, uid, type BoardEdge, type BoardNode, type CardData, type CardType } from "./types.ts";

export type TemplateId = "blank" | "mindmap" | "cornell" | "cause" | "compare" | "timeline" | "venn" | "concept";
export const TEMPLATES: { id: TemplateId; en: string; am: string; hint: string }[] = [
  { id: "blank", en: "Blank", am: "ባዶ", hint: "An empty board" },
  { id: "mindmap", en: "Mind map", am: "የሐሳብ ካርታ", hint: "A central topic with branches" },
  { id: "cornell", en: "Cornell notes", am: "የኮርኔል ማስታወሻ", hint: "Cues · notes · summary" },
  { id: "cause", en: "Cause → Effect → Solution", am: "ምክንያት → ውጤት → መፍትሔ", hint: "Great for essays" },
  { id: "compare", en: "Compare & contrast", am: "ማነጻጸር", hint: "Two columns + both" },
  { id: "timeline", en: "Timeline", am: "የጊዜ መስመር", hint: "Events in order (History)" },
  { id: "venn", en: "Venn notes", am: "የቬን ማስታወሻ", hint: "A Venn drawing with note cards (Math)" },
  { id: "concept", en: "Concept map", am: "የጽንሰ ሐሳብ ካርታ", hint: "Link ideas with labelled arrows" },
];

export function buildTemplate(id: TemplateId, topic: string): { nodes: BoardNode[]; edges: BoardEdge[] } {
  const nodes: BoardNode[] = [];
  const edges: BoardEdge[] = [];
  let z = 1;
  const add = (type: CardType, x: number, y: number, data: CardData, size?: { w: number; h: number }) => {
    const s = size ?? CARD_SIZE[type];
    const n: BoardNode = { id: uid(), type, x, y, w: s.w, h: s.h, z: type === "frame" ? 0 : z++, data, updated_at: now() };
    nodes.push(n);
    return n;
  };
  const link = (a: BoardNode, b: BoardNode, label?: string) => edges.push({ id: uid(), source: a.id, target: b.id, label, updated_at: now() });
  const inFrame = (f: BoardNode, n: BoardNode) => (n.parent = f.id);

  switch (id) {
    case "mindmap": {
      const c = add("note", 380, 220, { title: topic, body: "The main idea", color: "yellow" });
      const spots: [number, number][] = [
        [40, 40],
        [720, 40],
        [40, 400],
        [720, 400],
      ];
      spots.forEach(([x, y], i) => link(c, add("note", x, y, { title: `Branch ${i + 1}`, body: "- key point\n- example", color: "white" })));
      break;
    }
    case "cornell": {
      const cues = add("frame", 0, 0, { title: "Cues / questions" }, { w: 280, h: 460 });
      const notes = add("frame", 300, 0, { title: "Notes" }, { w: 520, h: 460 });
      const sum = add("frame", 0, 480, { title: "Summary" }, { w: 820, h: 200 });
      inFrame(cues, add("sticky", 40, 60, { title: "What is …?", color: "yellow" }));
      inFrame(notes, add("note", 340, 60, { title: topic, body: "Write the main notes here.", color: "white" }, { w: 440, h: 360 }));
      inFrame(sum, add("note", 40, 540, { title: "In short", body: "Summarise the lesson in 2–3 sentences.", color: "green" }, { w: 740, h: 120 }));
      break;
    }
    case "cause": {
      const a = add("frame", 0, 0, { title: "Causes" }, { w: 300, h: 420 });
      const b = add("frame", 360, 0, { title: "Effects" }, { w: 300, h: 420 });
      const c = add("frame", 720, 0, { title: "Solutions" }, { w: 300, h: 420 });
      const ca = add("note", 30, 60, { title: "Cause 1", body: "", color: "orange" });
      const ef = add("note", 390, 60, { title: "Effect 1", body: "", color: "pink" });
      const so = add("note", 750, 60, { title: "Solution 1", body: "", color: "green" });
      inFrame(a, ca);
      inFrame(b, ef);
      inFrame(c, so);
      link(ca, ef, "causes");
      link(ef, so, "solved by");
      break;
    }
    case "compare": {
      const a = add("frame", 0, 0, { title: "A" }, { w: 320, h: 420 });
      const both = add("frame", 340, 0, { title: "Both" }, { w: 280, h: 420 });
      const b = add("frame", 640, 0, { title: "B" }, { w: 320, h: 420 });
      inFrame(a, add("note", 30, 60, { title: "Only A", body: "- ", color: "blue" }));
      inFrame(both, add("note", 365, 60, { title: "Both", body: "- ", color: "green" }, { w: 230, h: 170 }));
      inFrame(b, add("note", 670, 60, { title: "Only B", body: "- ", color: "pink" }));
      break;
    }
    case "timeline": {
      let prev: BoardNode | null = null;
      for (let i = 0; i < 4; i++) {
        const n = add("note", i * 300, i % 2 ? 200 : 0, { title: `Date ${i + 1}`, body: "What happened", color: i % 2 ? "blue" : "yellow" }, { w: 240, h: 140 });
        if (prev) link(prev, n, "then");
        prev = n;
      }
      break;
    }
    case "venn": {
      add("drawing", 0, 0, { title: "Venn diagram", drawing: { items: [], paper: "blank", template: "venn2" } }, { w: 420, h: 300 });
      add("note", 460, 0, { title: "Only A", body: "", color: "blue" });
      add("note", 460, 190, { title: "Only B", body: "", color: "pink" });
      add("note", 0, 330, { title: "A ∩ B", body: "", color: "green" });
      break;
    }
    case "concept": {
      const a = add("note", 0, 0, { title: topic, body: "", color: "yellow" });
      const b = add("note", 400, 0, { title: "Idea", body: "", color: "white" });
      link(a, b, "leads to");
      add("sticky", 0, 240, { title: "Tip", body: "Drag from a card's edge to another card to link ideas. Tap an arrow to label it.", color: "yellow" }, { w: 280, h: 150 });
      break;
    }
    default:
      break;
  }
  return { nodes, edges };
}
