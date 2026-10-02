import "server-only";
import { neon } from "@neondatabase/serverless";
import { promises as fs } from "fs";
import path from "path";

/**
 * Tiny persistence layer for app state that is NOT memory:
 * users, chat threads, custom sims, and a local audit log of what we sent to Walrus Memory.
 *
 * Walrus Memory is the source of truth for what the bot *knows* about a user.
 * The memlog table only exists so the UI can show "what got remembered, when" —
 * the MemWal SDK has no "list memories" call.
 *
 * Backend: Neon Postgres when DATABASE_URL is set, otherwise a JSON file in .data/ (local dev).
 */

export type User = {
  id: string;
  username: string;
  pass_hash: string;
  memwal_account_id: string | null;
  memwal_key_enc: string | null;
  created_at: string;
};

export type Thread = {
  id: string;
  user_id: string;
  title: string;
  sim_id: string;
  memory_on: boolean;
  messages: unknown[];
  created_at: string;
  updated_at: string;
};

export type MemLog = {
  id: string;
  user_id: string;
  kind: string;
  sim_id: string | null;
  text: string;
  job_id: string | null;
  blob_id: string | null;
  status: string;
  source: string;
  created_at: string;
};

/** An AI-built bench. title = bench name, description = tagline, code = the sim script (see sim-gen.ts). */
export type CustomSim = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  brief: string;
  prompt: string;
  code: string;
  params: unknown[];
  version: number;
  created_at: string;
};

type Tables = {
  users: User[];
  threads: Thread[];
  memlog: MemLog[];
  custom_sims: CustomSim[];
};

const DATABASE_URL = process.env.DATABASE_URL;

// ---------------------------------------------------------------------------
// Postgres backend
// ---------------------------------------------------------------------------

const sql = DATABASE_URL ? neon(DATABASE_URL) : null;
let schemaReady: Promise<void> | null = null;

function ensureSchema() {
  if (!sql) return Promise.resolve();
  schemaReady ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      pass_hash TEXT NOT NULL,
      memwal_account_id TEXT,
      memwal_key_enc TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      sim_id TEXT NOT NULL,
      memory_on BOOLEAN NOT NULL DEFAULT true,
      messages JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS memlog (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      sim_id TEXT,
      text TEXT NOT NULL,
      job_id TEXT,
      blob_id TEXT,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS custom_sims (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      html TEXT NOT NULL,
      params JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    // v2: custom sims store the generated script + brief (html column kept for old rows)
    await sql`ALTER TABLE custom_sims ADD COLUMN IF NOT EXISTS brief TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE custom_sims ADD COLUMN IF NOT EXISTS prompt TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE custom_sims ADD COLUMN IF NOT EXISTS code TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE custom_sims ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1`;
    await sql`CREATE INDEX IF NOT EXISTS threads_user_idx ON threads(user_id, updated_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS memlog_user_idx ON memlog(user_id, created_at DESC)`;
  })();
  return schemaReady;
}

function iso<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const k of ["created_at", "updated_at"]) {
    if (out[k] instanceof Date) out[k] = (out[k] as Date).toISOString();
  }
  return out as T;
}

// ---------------------------------------------------------------------------
// JSON file backend (local dev only — not safe for concurrent serverless use)
// ---------------------------------------------------------------------------

const FILE = path.join(process.cwd(), ".data", "db.json");
let fileLock: Promise<unknown> = Promise.resolve();

async function readFile(): Promise<Tables> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return { users: [], threads: [], memlog: [], custom_sims: [] };
  }
}

function withFile<R>(fn: (t: Tables) => R | Promise<R>, write = false): Promise<R> {
  const run = fileLock.then(async () => {
    // Serverless filesystems are read-only, so the file store only works locally.
    if (process.env.VERCEL) throw new Error("No database configured: set DATABASE_URL (e.g. add Neon in the Vercel dashboard).");
    const t = await readFile();
    const r = await fn(t);
    if (write) {
      await fs.mkdir(path.dirname(FILE), { recursive: true });
      await fs.writeFile(FILE, JSON.stringify(t, null, 2));
    }
    return r;
  });
  fileLock = run.catch(() => undefined);
  return run;
}

const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const db = {
  backend: sql ? "postgres" : "file",

  async getUserByName(username: string): Promise<User | null> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`SELECT * FROM users WHERE username = ${username}`;
      return rows[0] ? iso(rows[0] as User) : null;
    }
    return withFile((t) => t.users.find((u) => u.username === username) ?? null);
  },

  async getUser(id: string): Promise<User | null> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
      return rows[0] ? iso(rows[0] as User) : null;
    }
    return withFile((t) => t.users.find((u) => u.id === id) ?? null);
  },

  async createUser(u: Omit<User, "created_at">): Promise<User> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`INSERT INTO users (id, username, pass_hash, memwal_account_id, memwal_key_enc)
        VALUES (${u.id}, ${u.username}, ${u.pass_hash}, ${u.memwal_account_id}, ${u.memwal_key_enc})
        RETURNING *`;
      return iso(rows[0] as User);
    }
    return withFile((t) => {
      const user = { ...u, created_at: now() };
      t.users.push(user);
      return user;
    }, true);
  },

  async updateUserMemwal(id: string, accountId: string | null, keyEnc: string | null) {
    if (sql) {
      await ensureSchema();
      await sql`UPDATE users SET memwal_account_id = ${accountId}, memwal_key_enc = ${keyEnc} WHERE id = ${id}`;
      return;
    }
    await withFile((t) => {
      const u = t.users.find((x) => x.id === id);
      if (u) {
        u.memwal_account_id = accountId;
        u.memwal_key_enc = keyEnc;
      }
    }, true);
  },

  async listThreads(userId: string): Promise<Omit<Thread, "messages">[]> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`SELECT id, user_id, title, sim_id, memory_on, created_at, updated_at
        FROM threads WHERE user_id = ${userId} ORDER BY updated_at DESC LIMIT 100`;
      return rows.map((r) => iso(r as Thread));
    }
    return withFile((t) =>
      t.threads
        .filter((x) => x.user_id === userId)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ messages, ...rest }) => rest),
    );
  },

  async getThread(userId: string, id: string): Promise<Thread | null> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`SELECT * FROM threads WHERE id = ${id} AND user_id = ${userId}`;
      return rows[0] ? iso(rows[0] as Thread) : null;
    }
    return withFile((t) => t.threads.find((x) => x.id === id && x.user_id === userId) ?? null);
  },

  async createThread(th: Omit<Thread, "created_at" | "updated_at">): Promise<Thread> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`INSERT INTO threads (id, user_id, title, sim_id, memory_on, messages)
        VALUES (${th.id}, ${th.user_id}, ${th.title}, ${th.sim_id}, ${th.memory_on}, ${JSON.stringify(th.messages)}::jsonb)
        RETURNING *`;
      return iso(rows[0] as Thread);
    }
    return withFile((t) => {
      const thread = { ...th, created_at: now(), updated_at: now() };
      t.threads.push(thread);
      return thread;
    }, true);
  },

  async updateThread(
    userId: string,
    id: string,
    patch: Partial<Pick<Thread, "title" | "sim_id" | "memory_on" | "messages">>,
  ) {
    if (sql) {
      await ensureSchema();
      const cur = await this.getThread(userId, id);
      if (!cur) return;
      const next = { ...cur, ...patch };
      await sql`UPDATE threads SET title = ${next.title}, sim_id = ${next.sim_id}, memory_on = ${next.memory_on},
        messages = ${JSON.stringify(next.messages)}::jsonb, updated_at = now()
        WHERE id = ${id} AND user_id = ${userId}`;
      return;
    }
    await withFile((t) => {
      const th = t.threads.find((x) => x.id === id && x.user_id === userId);
      if (th) Object.assign(th, patch, { updated_at: now() });
    }, true);
  },

  async deleteThread(userId: string, id: string) {
    if (sql) {
      await ensureSchema();
      await sql`DELETE FROM threads WHERE id = ${id} AND user_id = ${userId}`;
      return;
    }
    await withFile((t) => {
      t.threads = t.threads.filter((x) => !(x.id === id && x.user_id === userId));
    }, true);
  },

  async addMemLog(m: Omit<MemLog, "created_at">): Promise<MemLog> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`INSERT INTO memlog (id, user_id, kind, sim_id, text, job_id, blob_id, status, source)
        VALUES (${m.id}, ${m.user_id}, ${m.kind}, ${m.sim_id}, ${m.text}, ${m.job_id}, ${m.blob_id}, ${m.status}, ${m.source})
        RETURNING *`;
      return iso(rows[0] as MemLog);
    }
    return withFile((t) => {
      const row = { ...m, created_at: now() };
      t.memlog.push(row);
      return row;
    }, true);
  },

  async updateMemLog(id: string, patch: Partial<Pick<MemLog, "status" | "blob_id" | "job_id">>) {
    if (sql) {
      await ensureSchema();
      await sql`UPDATE memlog SET
        status = COALESCE(${patch.status ?? null}, status),
        blob_id = COALESCE(${patch.blob_id ?? null}, blob_id),
        job_id = COALESCE(${patch.job_id ?? null}, job_id)
        WHERE id = ${id}`;
      return;
    }
    await withFile((t) => {
      const row = t.memlog.find((x) => x.id === id);
      if (row) Object.assign(row, Object.fromEntries(Object.entries(patch).filter(([, v]) => v != null)));
    }, true);
  },

  async listMemLog(userId: string, limit = 200): Promise<MemLog[]> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`SELECT * FROM memlog WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit}`;
      return rows.map((r) => iso(r as MemLog));
    }
    return withFile((t) =>
      t.memlog
        .filter((x) => x.user_id === userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit),
    );
  },

  async createCustomSim(s: Omit<CustomSim, "created_at" | "version">): Promise<CustomSim> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`INSERT INTO custom_sims (id, user_id, title, description, html, brief, prompt, code, params)
        VALUES (${s.id}, ${s.user_id}, ${s.title}, ${s.description}, '', ${s.brief}, ${s.prompt}, ${s.code}, ${JSON.stringify(s.params)}::jsonb)
        RETURNING id, user_id, title, description, brief, prompt, code, params, version, created_at`;
      return iso(rows[0] as CustomSim);
    }
    return withFile((t) => {
      const row = { ...s, version: 1, created_at: now() };
      t.custom_sims.push(row);
      return row;
    }, true);
  },

  async updateCustomSim(userId: string, id: string, patch: Partial<Pick<CustomSim, "title" | "description" | "brief" | "code" | "params">>) {
    if (sql) {
      await ensureSchema();
      const cur = await this.getCustomSim(userId, id);
      if (!cur) return null;
      const n = { ...cur, ...patch };
      const rows = await sql`UPDATE custom_sims SET title = ${n.title}, description = ${n.description}, brief = ${n.brief},
          code = ${n.code}, params = ${JSON.stringify(n.params)}::jsonb, version = version + 1
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING id, user_id, title, description, brief, prompt, code, params, version, created_at`;
      return rows[0] ? iso(rows[0] as CustomSim) : null;
    }
    return withFile((t) => {
      const row = t.custom_sims.find((x) => x.id === id && x.user_id === userId);
      if (!row) return null;
      Object.assign(row, patch, { version: (row.version ?? 1) + 1 });
      return row;
    }, true);
  },

  async getCustomSim(userId: string, id: string): Promise<CustomSim | null> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`SELECT id, user_id, title, description, brief, prompt, code, params, version, created_at
        FROM custom_sims WHERE id = ${id} AND user_id = ${userId}`;
      return rows[0] ? iso(rows[0] as CustomSim) : null;
    }
    return withFile((t) => t.custom_sims.find((x) => x.id === id && x.user_id === userId) ?? null);
  },

  async listCustomSims(userId: string): Promise<Omit<CustomSim, "code">[]> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`SELECT id, user_id, title, description, brief, prompt, params, version, created_at
        FROM custom_sims WHERE user_id = ${userId} ORDER BY created_at DESC`;
      return rows.map((r) => iso(r as CustomSim));
    }
    return withFile((t) =>
      t.custom_sims
        .filter((x) => x.user_id === userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ code, ...rest }) => rest),
    );
  },
};
