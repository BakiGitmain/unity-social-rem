import "server-only";

/** OpenAI moderation (free). Fails open: the system prompt still refuses harmful requests. Used by Rem on the site and on Telegram. */
export async function moderate(text: string): Promise<{ flagged: boolean; categories: string[] }> {
  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { flagged: false, categories: [] };
    const data = (await res.json()) as { results?: { flagged?: boolean; categories?: Record<string, boolean> }[] };
    const r = data.results?.[0];
    return {
      flagged: !!r?.flagged,
      categories: Object.entries(r?.categories ?? {})
        .filter(([, v]) => v)
        .map(([k]) => k),
    };
  } catch {
    return { flagged: false, categories: [] };
  }
}
