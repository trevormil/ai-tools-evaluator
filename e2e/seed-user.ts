/** Insert the deterministic e2e test user + session. Idempotent. Run under bun. */
import { getDb, users, sessions } from "../packages/db/src/index";

const db = getDb();
if (
  !db
    .select()
    .from(users)
    .all()
    .some((u) => u.username === "e2euser")
) {
  db.insert(users).values({ id: "e2euser", username: "e2euser", displayName: "E2E User" }).run();
}
if (
  !db
    .select()
    .from(sessions)
    .all()
    .some((s) => s.id === "e2e-token")
) {
  db.insert(sessions)
    .values({
      id: "e2e-token",
      userId: "e2euser",
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
    })
    .run();
}
console.log("e2e user + session ready");
