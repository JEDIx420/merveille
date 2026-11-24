/**
 * Test D1 Database adapter wrapping Node.js 22 native DatabaseSync (:memory:).
 * Executes genuine SQLite queries, migrations, and transactions with zero external mocks.
 * Also provides in-memory R2 bucket adapter for multipart uploads, range requests, and private storage.
 */

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { executeMigration } from "@/server/db";

export function createTestD1Database(): D1Database {
  const sqlite = new DatabaseSync(":memory:");

  const adapter: D1Database = {
    // @ts-ignore
    exec: async (sql: string) => {
      sqlite.exec(sql);
      return { count: 0, duration: 0 };
    },
    prepare: (sql: string) => {
      let boundParams: any[] = [];
      return {
        bind: (...params: any[]) => {
          boundParams = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T = any>() => {
              const stmt = sqlite.prepare(sql);
              const row = stmt.get(...boundParams);
              return (row as T) || null;
            },
            all: async <T = any>() => {
              const stmt = sqlite.prepare(sql);
              const rows = stmt.all(...boundParams);
              return { results: rows as T[], success: true, meta: {} as any };
            },
            run: async () => {
              const stmt = sqlite.prepare(sql);
              const info = stmt.run(...boundParams);
              return {
                success: true,
                meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } as any,
              };
            },
          } as any;
        },
        first: async <T = any>() => {
          const stmt = sqlite.prepare(sql);
          return (stmt.get() as T) || null;
        },
        all: async <T = any>() => {
          const stmt = sqlite.prepare(sql);
          return { results: stmt.all() as T[], success: true, meta: {} as any };
        },
        run: async () => {
          const stmt = sqlite.prepare(sql);
          const info = stmt.run();
          return {
            success: true,
            meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } as any,
          };
        },
      } as any;
    },
    batch: async (statements: any[]) => {
      const results: D1Response[] = [];
      sqlite.exec("BEGIN TRANSACTION");
      try {
        for (const s of statements) {
          const res = await s.run();
          results.push(res);
        }
        sqlite.exec("COMMIT");
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
      return results;
    },
    dump: async () => new ArrayBuffer(0),
  };

  return adapter;
}

export interface InMemoryR2Object {
  key: string;
  bytes: Uint8Array;
  httpMetadata?: Record<string, string>;
  customMetadata?: Record<string, string>;
  uploaded: Date;
}

export function createTestR2Bucket(): R2Bucket {
  const store = new Map<string, InMemoryR2Object>();
  const activeMultipart = new Map<string, { key: string; parts: Map<number, Uint8Array> }>();

  const bucket: any = {
    get: async (key: string, options?: { range?: { offset?: number; length?: number } }) => {
      const obj = store.get(key);
      if (!obj) return null;

      let slice = obj.bytes;
      if (options?.range) {
        const offset = options.range.offset || 0;
        const length = options.range.length !== undefined ? options.range.length : obj.bytes.length - offset;
        slice = obj.bytes.slice(offset, offset + length);
      }

      return {
        key: obj.key,
        size: obj.bytes.length,
        httpMetadata: obj.httpMetadata || {},
        customMetadata: obj.customMetadata || {},
        uploaded: obj.uploaded,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(slice);
            controller.close();
          },
        }),
        arrayBuffer: async () => slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength),
        text: async () => new TextDecoder().decode(slice),
      };
    },

    head: async (key: string) => {
      const obj = store.get(key);
      if (!obj) return null;
      return {
        key: obj.key,
        size: obj.bytes.length,
        httpMetadata: obj.httpMetadata || {},
        customMetadata: obj.customMetadata || {},
        uploaded: obj.uploaded,
      };
    },

    put: async (key: string, value: any, options?: any) => {
      let bytes: Uint8Array;
      if (typeof value === "string") {
        bytes = new TextEncoder().encode(value);
      } else if (value instanceof Uint8Array) {
        bytes = value;
      } else if (value instanceof ArrayBuffer) {
        bytes = new Uint8Array(value);
      } else if (value && typeof value.getReader === "function") {
        const reader = value.getReader();
        const chunks: Uint8Array[] = [];
        let done = false;
        while (!done) {
          const res = await reader.read();
          if (res.done) break;
          if (res.value) chunks.push(res.value);
        }
        const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
        bytes = new Uint8Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
          bytes.set(c, offset);
          offset += c.length;
        }
      } else {
        bytes = new Uint8Array(0);
      }

      const obj: InMemoryR2Object = {
        key,
        bytes,
        httpMetadata: options?.httpMetadata || {},
        customMetadata: options?.customMetadata || {},
        uploaded: new Date(),
      };
      store.set(key, obj);
      return {
        key,
        size: bytes.length,
        httpMetadata: obj.httpMetadata,
      };
    },

    delete: async (keys: string | string[]) => {
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const k of keyList) {
        store.delete(k);
      }
    },

    createMultipartUpload: async (key: string) => {
      const uploadId = `mp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      activeMultipart.set(uploadId, { key, parts: new Map<number, Uint8Array>() });

      const mpUpload = {
        key,
        uploadId,
        uploadPart: async (partNumber: number, value: any) => {
          let bytes: Uint8Array;
          if (typeof value === "string") bytes = new TextEncoder().encode(value);
          else if (value instanceof Uint8Array) bytes = value;
          else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
          else bytes = new Uint8Array(0);

          const mp = activeMultipart.get(uploadId);
          if (!mp) throw new Error("Multipart upload session not found or aborted.");
          mp.parts.set(partNumber, bytes);

          return {
            partNumber,
            etag: `"etag_${partNumber}_${bytes.length}"`,
          };
        },
        complete: async (uploadedParts: Array<{ partNumber: number; etag: string }>) => {
          const mp = activeMultipart.get(uploadId);
          if (!mp) throw new Error("Multipart upload session not found or aborted.");

          // Sort parts by part number
          const sorted = [...uploadedParts].sort((a, b) => a.partNumber - b.partNumber);
          const chunks: Uint8Array[] = [];
          for (const p of sorted) {
            const chunk = mp.parts.get(p.partNumber);
            if (!chunk) throw new Error(`Missing part ${p.partNumber}`);
            chunks.push(chunk);
          }

          const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
          const fullBytes = new Uint8Array(totalLen);
          let offset = 0;
          for (const c of chunks) {
            fullBytes.set(c, offset);
            offset += c.length;
          }

          const finalizedObj: InMemoryR2Object = {
            key,
            bytes: fullBytes,
            uploaded: new Date(),
          };
          store.set(key, finalizedObj);
          activeMultipart.delete(uploadId);

          return {
            key,
            size: totalLen,
            etag: `"final_${uploadId}"`,
          };
        },
        abort: async () => {
          activeMultipart.delete(uploadId);
        },
      };

      return mpUpload;
    },

    resumeMultipartUpload: async (key: string, uploadId: string) => {
      const mp = activeMultipart.get(uploadId);
      if (!mp) throw new Error("Multipart upload session not found or aborted.");

      return {
        key,
        uploadId,
        uploadPart: async (partNumber: number, value: any) => {
          let bytes: Uint8Array;
          if (typeof value === "string") bytes = new TextEncoder().encode(value);
          else if (value instanceof Uint8Array) bytes = value;
          else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
          else bytes = new Uint8Array(0);

          mp.parts.set(partNumber, bytes);
          return {
            partNumber,
            etag: `"etag_${partNumber}_${bytes.length}"`,
          };
        },
        complete: async (uploadedParts: Array<{ partNumber: number; etag: string }>) => {
          const sorted = [...uploadedParts].sort((a, b) => a.partNumber - b.partNumber);
          const chunks: Uint8Array[] = [];
          for (const p of sorted) {
            const chunk = mp.parts.get(p.partNumber);
            if (!chunk) throw new Error(`Missing part ${p.partNumber}`);
            chunks.push(chunk);
          }

          const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
          const fullBytes = new Uint8Array(totalLen);
          let offset = 0;
          for (const c of chunks) {
            fullBytes.set(c, offset);
            offset += c.length;
          }

          const finalizedObj: InMemoryR2Object = {
            key,
            bytes: fullBytes,
            uploaded: new Date(),
          };
          store.set(key, finalizedObj);
          activeMultipart.delete(uploadId);

          return {
            key,
            size: totalLen,
            etag: `"final_${uploadId}"`,
          };
        },
        abort: async () => {
          activeMultipart.delete(uploadId);
        },
      };
    },
  };

  return bucket as R2Bucket;
}

/**
 * Initialize test D1 database and apply repository migration files.
 */
export async function setupMigratedTestDb(): Promise<D1Database> {
  const db = createTestD1Database();
  const migrationsDir = path.resolve(__dirname, "../migrations");
  const files = [
    "0001_identity_and_permissions.sql",
    "0002_projects_and_enquiries.sql",
    "0003_files_and_media.sql",
  ];

  for (const file of files) {
    const migrationPath = path.join(migrationsDir, file);
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      await executeMigration(db, sql);
    }
  }
  return db;
}
