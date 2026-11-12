/**
 * NOTES PRIVACY (RLS) against the real database. Run: npm run test:notes (no dev server needed).
 * User A owns a board with a card, an arrow, a flashcard and an image. User B, an anonymous visitor and even a
 * 2FA admin must not read or change any of it (the admin only gets counts). Temporary users are deleted after.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(new URL("../.env.local", import.meta.url));
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = createClient(URL_, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const created = [];

async function user(prefix, role = "student") {
  const username = `${prefix}_${randomBytes(3).toString("hex")}`;
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await service.auth.admin.createUser({ email: `${username}@users.unitysocialrem.app`, password, email_confirm: true, user_metadata: { username } });
  if (error) throw error;
  created.push(data.user.id);
  if (role === "admin") await service.from("profiles_private").update({ role: "admin" }).eq("id", data.user.id);
  const sb = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const r = await sb.auth.signInWithPassword({ email: `${username}@users.unitysocialrem.app`, password });
  if (r.error) throw r.error;
  return { id: data.user.id, sb };
}
function totp(secret) {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/=+$/, "").toUpperCase()) bits += abc.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

let A, B, ADM, lessonId;
const boardId = randomUUID(),
  nodeId = randomUUID(),
  node2 = randomUUID(),
  edgeId = randomUUID();
let imagePath;

before(async () => {
  [A, B, ADM] = await Promise.all([user("notes_a"), user("notes_b"), user("notes_adm", "admin")]);
  const en = await ADM.sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "t" });
  if (en.error) throw en.error;
  const v = await ADM.sb.auth.mfa.challengeAndVerify({ factorId: en.data.id, code: totp(en.data.totp.secret) });
  if (v.error) throw v.error;
  lessonId = (await service.from("lessons").select("id").eq("status", "published").limit(1).single()).data.id;

  // A builds a board
  const b = await A.sb.from("boards").insert({ id: boardId, lesson_id: lessonId, title: "Secret board", emoji: "notebook" });
  if (b.error) throw b.error;
  const n = await A.sb.from("board_nodes").insert([
    { id: nodeId, board_id: boardId, type: "note", x: 0, y: 0, w: 200, h: 100, data: { title: "Secret", body: "A's notes" } },
    { id: node2, board_id: boardId, type: "sticky", x: 300, y: 0, w: 180, h: 160, data: { title: "Two" } },
  ]);
  if (n.error) throw n.error;
  const e = await A.sb.from("board_edges").insert({ id: edgeId, board_id: boardId, source: nodeId, target: node2, label: "causes" });
  if (e.error) throw e.error;
  const f = await A.sb.from("flashcards").insert({ board_id: boardId, node_id: nodeId, front: "Q?", back: "A." });
  if (f.error) throw f.error;
  imagePath = `${A.id}/${boardId}/${nodeId}.webp`;
  const up = await A.sb.storage.from("note-images").upload(imagePath, Buffer.from("RIFF0000WEBPVP8 "), { contentType: "image/webp" });
  if (up.error) throw up.error;
});

after(async () => {
  await service.storage.from("note-images").remove([imagePath]).catch(() => {});
  for (const id of created) await service.auth.admin.deleteUser(id);
});

test("the owner sees everything", async () => {
  assert.equal((await A.sb.from("boards").select("id").eq("id", boardId)).data.length, 1);
  assert.equal((await A.sb.from("board_nodes").select("id").eq("board_id", boardId)).data.length, 2);
  assert.equal((await A.sb.from("board_edges").select("id").eq("board_id", boardId)).data.length, 1);
  assert.equal((await A.sb.from("flashcards").select("id").eq("board_id", boardId)).data.length, 1);
  const img = await A.sb.storage.from("note-images").download(imagePath);
  assert.equal(img.error, null);
});

test("user B cannot read A's boards, cards, arrows, flashcards or images", async () => {
  for (const [t, col] of [
    ["boards", "id"],
    ["board_nodes", "board_id"],
    ["board_edges", "board_id"],
    ["flashcards", "board_id"],
  ]) {
    const { data } = await B.sb.from(t).select("*").eq(col, boardId);
    assert.equal((data ?? []).length, 0, `${t} must be hidden`);
  }
  const img = await B.sb.storage.from("note-images").download(imagePath);
  assert.ok(img.error, "A's image must not download for B");
  const list = await B.sb.storage.from("note-images").list(`${A.id}/${boardId}`);
  assert.equal((list.data ?? []).length, 0);
  const signed = await B.sb.storage.from("note-images").createSignedUrl(imagePath, 60);
  assert.ok(signed.error, "B cannot sign A's image");
});

test("user B cannot change or delete A's notes", async () => {
  const u1 = await B.sb.from("boards").update({ title: "hacked" }).eq("id", boardId).select();
  assert.equal((u1.data ?? []).length, 0);
  const u2 = await B.sb.from("board_nodes").update({ data: { title: "hacked" } }).eq("id", nodeId).select();
  assert.equal((u2.data ?? []).length, 0);
  const d1 = await B.sb.from("board_edges").delete().eq("id", edgeId).select();
  assert.equal((d1.data ?? []).length, 0);
  const d2 = await B.sb.from("flashcards").delete().eq("board_id", boardId).select();
  assert.equal((d2.data ?? []).length, 0);
  // writing INTO A's board
  const i1 = await B.sb.from("board_nodes").insert({ id: randomUUID(), board_id: boardId, type: "note", x: 0, y: 0, w: 10, h: 10 });
  assert.ok(i1.error, "B cannot add a card to A's board");
  const i2 = await B.sb.from("board_edges").insert({ id: randomUUID(), board_id: boardId, source: nodeId, target: node2 });
  assert.ok(i2.error, "B cannot add an arrow to A's board");
  const i3 = await B.sb.from("flashcards").insert({ board_id: boardId, node_id: node2, front: "x" });
  assert.ok(i3.error, "B cannot add a flashcard to A's board");
  // pretending to be A
  const i4 = await B.sb.from("boards").insert({ user_id: A.id, lesson_id: lessonId, title: "fake" });
  assert.ok(i4.error, "B cannot create a board for A");
  const up = await B.sb.storage.from("note-images").upload(`${A.id}/${boardId}/x.webp`, Buffer.from("x"), { contentType: "image/webp" });
  assert.ok(up.error, "B cannot upload into A's folder");
  const rm = await B.sb.storage.from("note-images").remove([imagePath]);
  assert.equal((rm.data ?? []).length, 0, "B cannot delete A's image");
  // A's data is unchanged
  const { data } = await service.from("board_nodes").select("data").eq("id", nodeId).single();
  assert.equal(data.data.title, "Secret");
  assert.equal((await service.from("board_edges").select("id").eq("id", edgeId)).data.length, 1);
});

test("an anonymous visitor sees nothing", async () => {
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  for (const t of ["boards", "board_nodes", "board_edges", "flashcards"]) {
    const { data } = await anon.from(t).select("*").limit(5);
    assert.equal((data ?? []).length, 0, `${t} must be hidden from visitors`);
  }
  assert.ok((await anon.storage.from("note-images").download(imagePath)).error);
});

test("even a 2FA admin gets counts only, never the content", async () => {
  assert.equal((await ADM.sb.rpc("is_admin")).data, true, "admin is at AAL2");
  for (const t of ["boards", "board_nodes", "board_edges", "flashcards"]) {
    const { data } = await ADM.sb.from(t).select("*").eq(t === "boards" ? "id" : "board_id", boardId);
    assert.equal((data ?? []).length, 0, `${t}: no admin content access`);
  }
  assert.ok((await ADM.sb.storage.from("note-images").download(imagePath)).error, "no admin image access");
  const stats = await ADM.sb.rpc("admin_user_notes_stats", { p_user: A.id });
  assert.equal(stats.error, null);
  assert.deepEqual({ boards: stats.data.boards, cards: stats.data.cards, flashcards: stats.data.flashcards }, { boards: 1, cards: 2, flashcards: 1 });
  assert.ok(stats.data.storage_bytes > 0);
  assert.ok((await B.sb.rpc("admin_user_notes_stats", { p_user: A.id })).error, "students cannot call it");
});

test("deleting a card removes its flashcard; deleting the board removes everything", async () => {
  await A.sb.from("board_nodes").delete().eq("id", nodeId);
  assert.equal((await A.sb.from("flashcards").select("id").eq("board_id", boardId)).data.length, 0);
  await A.sb.from("boards").delete().eq("id", boardId);
  assert.equal((await service.from("board_nodes").select("id").eq("board_id", boardId)).data.length, 0);
  assert.equal((await service.from("board_edges").select("id").eq("board_id", boardId)).data.length, 0);
});
