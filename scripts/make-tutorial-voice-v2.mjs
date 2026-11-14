/**
 * Tutorial voice-over v2 (English). Run: node scripts/make-tutorial-voice-v2.mjs
 *
 * For each line: OpenAI TTS (gpt-4o-mini-tts, voice "coral", mp3) → tutorial-voice-v2/<id>.mp3, then whisper-1
 * word timestamps (verbose_json) → tutorial-voice-v2/<id>.json (to sync taps with the voice), and
 * tutorial-voice-v2/durations.json. Existing files are skipped, so it is safe to re-run.
 * Uses OPENAI_API_KEY from .env.local (never printed). The folder is in .gitignore: never commit the audio.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
process.loadEnvFile(join(ROOT, ".env.local"));
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) throw new Error("OPENAI_API_KEY is missing in .env.local");
const OUT = join(ROOT, "tutorial-voice-v2");
mkdirSync(OUT, { recursive: true });

const VOICE = "coral"; // same voice as tutorial-voice/
const INSTRUCTIONS =
  "Warm, friendly, clear teacher talking to Ethiopian university students. Natural steady pace, not rushed. Short natural pauses between sentences. Say 'Rem' like the word 'rem'. Read the text exactly as written.";

const LINES = {
  b01: "Welcome to Unity Social Rem, the study app made for our class, Social Science Section 1. Let me show you everything, step by step.",
  b02: "You can read every lesson without an account. But with an account, your progress, notes, flashcards and homework are saved, on any phone or computer.",
  b03: "To make one, tap the person icon at the bottom, then tap Sign up.",
  b04: "Type any username you like. You don't need an email or a phone number, so your personal information stays private.",
  b05: "Then make a strong password, at least eight characters, and tap Create account. That's it. You're in!",
  b06: "Already have an account? Tap Log in instead, and enter your username and password.",
  b07: "This is Home. At the top, you see today's date and a live clock. Tap twenty-four hour, or Ethiopian, to see the time the way you like.",
  b08: "The Today card shows your current class and the time left. If there's no class right now, it tells you the next one.",
  b09: "Tap Full schedule to see all your classes.",
  b10: "Pick a day to see its classes, with the time, room and floor. Scroll down for the rest of the day, and a summary of your week.",
  b11: "Tap Week to see the whole week at once.",
  b12: "Now let's study. Go back Home, and scroll down to choose a subject. Tap Geography.",
  b13: "Pick your grade, then open the unit.",
  b14: "Here are all the lessons in this unit. Each one shows how long it takes, and your progress. Tap a lesson to open it.",
  b15: "Every lesson has Full Notes, Main Topics, and a Quiz.",
  b16: "In Learn mode, the lesson is split into small parts. Read the first part, scroll down, and tap Next.",
  b17: "The bar shows how far you are. Want the whole lesson on one page? Tap Read all.",
  b18: "You can read in English, in Amharic, or both. With Both, the Amharic appears right under each English line.",
  b19: "Main Topics gives you only the key points, perfect for a quick review before a test.",
  b20: "Don't understand a sentence? Press and drag to select it. A small menu appears: Explain further, In Amharic, or Add to notes.",
  b21: "Tap Explain further, and Rem, your AI study helper, explains it simply.",
  b22: "Rem lives in this round button. You can drag it to the side, and it fades while you read, so it never covers your notes. Tap it any time to ask a question.",
  b23: "Ask in English or Amharic. Tap In Amharic for an Amharic answer, or Quiz me to test yourself right there.",
  b24: "When you finish a lesson, open the Quiz. Focus mode hides your notes, and every answer tells you why it's right or wrong.",
  b25: "Homework is inside the lesson too. If our teacher gave homework for a lesson, you'll find a Homework tab right here.",
  b26: "Only the exercises from class count. Tap a number to open a question.",
  b27: "Math answers work a little differently. Read the question, look at the drawing from class, then tap Tap to write.",
  b28: "This is your answer paper. Each step has its own line. Write with the pen, or use the Sigma button for math symbols like union and intersection. Or pick T, and type your answer.",
  b29: "Fill in every line. Then close the paper, choose your conclusion, and tap Check.",
  b30: "The AI reads your writing and shows exactly what it read, so you can fix it if it's wrong. Then it checks every step, and shades the Venn diagrams for you.",
  b31: "Stuck? Tap Tip for a hint, I'm stuck for help, or Show full solution to see every step.",
  b32: "You can also tap Type instead, and use the math keyboard with all the set symbols.",
  b33: "Now, Notes, the most powerful part. While you study, tap the notes button.",
  b34: "Make a board for this lesson. Give it a name, pick a template like Mind map, and tap Create.",
  b35: "Your lesson sits in the middle. Tap any card to write your own notes in it.",
  b36: "Tap Add to put in more: note cards, sticky notes, checklists, drawings, images, or links.",
  b37: "Connect ideas with arrows, and give each arrow a name. Then tap Tidy, and everything lines up neatly.",
  b38: "Tap Outline to read your whole board as a simple list.",
  b39: "After class, open Notes from the bottom bar. Your boards are grouped by subject, and you can search all your notes at once. Everything is saved, even without internet.",
  b40: "Turn any card into a flashcard. The question goes on the front, and the answer on the back.",
  b41: "When cards are due, tap Review now. Try to remember, tap Show answer, then rate how well you knew it. Hard cards come back sooner, so you won't forget them before the exam.",
  b42: "Here's a simple routine. Before class, check your schedule. While studying, use Learn mode, Rem, and Notes. After class, do the quiz, your homework, and your flashcards.",
  b43: "That's Unity Social Rem. Open unity social rem dot vercel dot app on your phone, and start learning. Good luck!",
};

async function withRetry(label, fn) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= 4) throw new Error(`${label}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

async function speak(text) {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: VOICE, input: text, instructions: INSTRUCTIONS, response_format: "mp3" }),
  });
  if (!res.ok) throw new Error(`TTS HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function transcribe(mp3, name) {
  const form = new FormData();
  form.append("file", new Blob([mp3], { type: "audio/mpeg" }), name);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("language", "en");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${KEY}` }, body: form });
  if (!res.ok) throw new Error(`Whisper HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const made = { tts: 0, whisper: 0 };
for (const [id, text] of Object.entries(LINES)) {
  const mp3Path = join(OUT, `${id}.mp3`);
  const jsonPath = join(OUT, `${id}.json`);
  if (!existsSync(mp3Path)) {
    writeFileSync(mp3Path, await withRetry(`${id} TTS`, () => speak(text)));
    made.tts++;
  }
  if (!existsSync(jsonPath)) {
    const mp3 = readFileSync(mp3Path);
    const t = await withRetry(`${id} whisper`, () => transcribe(mp3, `${id}.mp3`));
    writeFileSync(jsonPath, JSON.stringify(t, null, 2));
    made.whisper++;
  }
  process.stdout.write(`${id} `);
}
console.log(`\nnew TTS files: ${made.tts}, new transcripts: ${made.whisper}`);

const durations = {};
for (const id of Object.keys(LINES)) durations[id] = +JSON.parse(readFileSync(join(OUT, `${id}.json`), "utf8")).duration.toFixed(2);
writeFileSync(join(OUT, "durations.json"), JSON.stringify(durations, null, 2));
export { LINES };
