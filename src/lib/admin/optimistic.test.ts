import { test } from "node:test";
import assert from "node:assert/strict";
import { applyListChange, applyUserChange, type UserRowLike } from "./optimistic.ts";

const users: UserRowLike[] = [
  { id: "a", username: "abel", role: "student", banned: false, banned_until: null, ai_daily_limit: null },
  { id: "b", username: "beti", role: "student", banned: false, banned_until: null, ai_daily_limit: null },
  { id: "c", username: "eyosiyas", role: "admin", banned: false, banned_until: null, ai_daily_limit: null },
];

test("deleting users removes them from the list at once (no refresh needed)", () => {
  const after = applyUserChange(users, { type: "delete", ids: ["a", "b"] });
  assert.deepEqual(
    after.map((u) => u.username),
    ["eyosiyas"],
  );
  // The server list is untouched: if the action fails, React shows it again (rollback).
  assert.equal(users.length, 3);
});

test("ban / unban flips the status of exactly the selected users", () => {
  const banned = applyUserChange(users, { type: "ban", ids: ["b"], until: "2099-01-01T00:00:00Z" });
  assert.deepEqual(
    banned.map((u) => u.banned),
    [false, true, false],
  );
  const unbanned = applyUserChange(banned, { type: "unban", ids: ["b"] });
  assert.equal(unbanned[1]!.banned, false);
  assert.equal(unbanned[1]!.banned_until, null);
});

test("patching a user (role, username, AI limit) keeps the other fields", () => {
  const after = applyUserChange(users, { type: "patch", id: "a", patch: { role: "admin", ai_daily_limit: 5 } });
  assert.equal(after[0]!.role, "admin");
  assert.equal(after[0]!.ai_daily_limit, 5);
  assert.equal(after[0]!.username, "abel");
  assert.equal(after[1], users[1], "untouched rows keep their identity (no needless re-render)");
});

test("list changes: delete, insert a new row first, update in place", () => {
  type Row = { id: string; title: string };
  const rows: Row[] = [
    { id: "1", title: "Exam on Monday" },
    { id: "2", title: "Holiday" },
  ];
  assert.deepEqual(applyListChange(rows, { type: "delete", ids: ["1"] }), [{ id: "2", title: "Holiday" }]);
  assert.equal(applyListChange(rows, { type: "upsert", row: { id: "3", title: "New" } })[0]!.id, "3");
  assert.equal(applyListChange(rows, { type: "upsert", row: { id: "2", title: "Meskel" } })[1]!.title, "Meskel");
  assert.equal(applyListChange(rows, { type: "patch", ids: ["1", "2"], patch: { title: "x" } }).every((r) => r.title === "x"), true);
});
