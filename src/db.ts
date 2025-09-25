import fs from "fs";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "server/db.json");

type Entitlements = Record<string, { pro: boolean; activatedAt?: string }>;

interface DBShape {
  users: Array<{ id: string; email: string }>;
  entitlements: Entitlements;
}

function ensureSeed() {
  if (!fs.existsSync(DB_PATH)) {
    const seed: DBShape = {
      users: [{ id: "test-user-1", email: "test@juaco.app" }],
      entitlements: {},
    };
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2));
  }
}

export function readDB(): DBShape {
  ensureSeed();
  const txt = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(txt) as DBShape;
}

export function writeDB(db: DBShape) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function upsertPro(userId: string) {
  const db = readDB();
  db.entitlements[userId] = { pro: true, activatedAt: new Date().toISOString() };
  writeDB(db);
}

export function getEntitlements(userId: string) {
  const db = readDB();
  return db.entitlements[userId] ?? { pro: false };
}