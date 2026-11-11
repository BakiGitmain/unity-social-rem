/**
 * Tiny safe calculator for the mini calculator and NUMBER answers: + − × ÷ ^ √ ( ) and fractions like 3/4.
 * No eval(). Pure, tested in calc.test.ts.
 */
type Tok = { t: "num"; v: number } | { t: "op"; v: string } | { t: "(" } | { t: ")" };

function tokenize(src: string): Tok[] {
  const s = src.replace(/\s+/g, "").replace(/[−–]/g, "-").replace(/×/g, "*").replace(/÷/g, "/").replace(/²/g, "^2").replace(/³/g, "^3").replace(/,/g, ".");
  const out: Tok[] = [];
  for (let i = 0; i < s.length; ) {
    const c = s[i]!;
    const num = /^\d*\.?\d+(e[+-]?\d+)?/i.exec(s.slice(i)) ?? /^\d+\.?/.exec(s.slice(i));
    if (num && /[\d.]/.test(c)) {
      out.push({ t: "num", v: Number(num[0]) });
      i += num[0].length;
    } else if (c === "π") {
      out.push({ t: "num", v: Math.PI });
      i++;
    } else if ("+-*/^√%".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
    } else if (c === "(") {
      out.push({ t: "(" });
      i++;
    } else if (c === ")") {
      out.push({ t: ")" });
      i++;
    } else throw new Error(`Unknown symbol "${c}"`);
  }
  return out;
}

/** Evaluate; throws on bad input. Implicit multiplication: 2(3), 2√4, (1)(2). */
export function evaluate(src: string): number {
  const toks = tokenize(src);
  if (!toks.length) throw new Error("Empty");
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === "op" && (peek() as { v: string }).v === v;

  const atom = (): number => {
    const tk = toks[p++];
    if (!tk) throw new Error("Incomplete");
    if (tk.t === "num") return tk.v;
    if (tk.t === "(") {
      const v = expr();
      if (toks[p++]?.t !== ")") throw new Error("Missing )");
      return v;
    }
    if (tk.t === "op" && tk.v === "√") {
      const v = unary();
      if (v < 0) throw new Error("√ of a negative number");
      return Math.sqrt(v);
    }
    if (tk.t === "op" && tk.v === "-") return -unary();
    if (tk.t === "op" && tk.v === "+") return unary();
    throw new Error("Unexpected symbol");
  };
  const power = (): number => {
    const base = atom();
    if (isOp("^")) {
      p++;
      return base ** unary(); // right-associative
    }
    return base;
  };
  const unary = (): number => power();
  const term = (): number => {
    let v = unary();
    for (;;) {
      if (isOp("*")) {
        p++;
        v *= unary();
      } else if (isOp("/")) {
        p++;
        const d = unary();
        if (d === 0) throw new Error("Division by 0");
        v /= d;
      } else if (isOp("%")) {
        p++;
        v /= 100;
      } else if (peek() && (peek()!.t === "(" || peek()!.t === "num" || isOp("√"))) {
        v *= unary(); // implicit ×
      } else return v;
    }
  };
  const expr = (): number => {
    let v = term();
    for (;;) {
      if (isOp("+")) {
        p++;
        v += term();
      } else if (isOp("-")) {
        p++;
        v -= term();
      } else return v;
    }
  };
  const v = expr();
  if (p !== toks.length) throw new Error("Unexpected symbol");
  if (!Number.isFinite(v)) throw new Error("Too big");
  return v;
}

/** 0.75 → "3/4" when it is a simple fraction (denominator ≤ 1000), else null. */
export function toFraction(x: number): string | null {
  if (Number.isInteger(x)) return null;
  let h1 = 1,
    h0 = 0,
    k1 = 0,
    k0 = 1,
    b = x;
  for (let i = 0; i < 20; i++) {
    const a = Math.floor(b);
    [h1, h0] = [a * h1 + h0, h1];
    [k1, k0] = [a * k1 + k0, k1];
    if (Math.abs(x - h1 / k1) < 1e-9) break;
    b = 1 / (b - a);
  }
  if (k1 > 1000 || Math.abs(x - h1 / k1) > 1e-9) return null;
  return `${h1}/${k1}`;
}

/** Nice display: integers as is, otherwise up to 8 decimals without trailing zeros. */
export function formatNumber(x: number): string {
  if (Number.isInteger(x)) return String(x);
  return String(Number(x.toFixed(8)));
}

/** NUMBER answers: "1/2", "0.5", "−3", "2^3" all accepted. */
export function checkNumberAnswer(input: string, expected: number, tolerance = 1e-9): { correct: boolean; message: string } {
  try {
    const v = evaluate(input);
    const ok = Math.abs(v - expected) <= Math.max(tolerance, Math.abs(expected) * 1e-12);
    return { correct: ok, message: ok ? "Correct!" : "Not yet. Check your working and try again." };
  } catch (e) {
    return { correct: false, message: e instanceof Error && e.message !== "Empty" ? `Check your answer: ${e.message}` : "Type a number first" };
  }
}
