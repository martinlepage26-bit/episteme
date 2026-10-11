import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import { MONGO_PING_TIMEOUT_MS, pingAdmin } from "../db.js";
import { createStatusHandler, type StatusDependencies } from "./status.js";

const baseDeps = {
  authEnabled: true,
  accessEnabled: false,
  onError: () => {},
} satisfies Partial<StatusDependencies>;

async function fetchStatus(deps: StatusDependencies): Promise<{ status: number; body: unknown }> {
  const app = express();
  app.get("/api/status", createStatusHandler(deps));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/status`);
    const body: unknown = await response.json();
    return { status: response.status, body };
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("GET /api/status returns 200 and the historical fields when MongoDB answers", async () => {
  let pingCalls = 0;
  const response = await fetchStatus({
    ...baseDeps,
    timeoutMs: 200,
    ping: async (timeoutMs) => {
      pingCalls += 1;
      assert.equal(timeoutMs, 200);
      return { ok: 1 };
    },
  });

  assert.equal(response.status, 200);
  assert.equal(pingCalls, 1);
  assert.deepEqual(response.body, {
    status: "ok",
    product: "Épistémè",
    phase: 2,
    authEnabled: true,
    accessEnabled: false,
    dependencies: {
      mongodb: { status: "ok", error: null },
    },
  });
});

test("GET /api/status returns 503 naming mongodb when the ping fails", async () => {
  const response = await fetchStatus({
    ...baseDeps,
    timeoutMs: 200,
    ping: async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:27018");
    },
  });

  assert.equal(response.status, 503);
  assert.deepEqual(response.body, {
    status: "error",
    product: "Épistémè",
    phase: 2,
    authEnabled: true,
    accessEnabled: false,
    dependencies: {
      mongodb: { status: "error", error: "mongodb unavailable" },
    },
  });
});

test("GET /api/status treats a driver timeout error as mongodb timed out", async () => {
  const response = await fetchStatus({
    ...baseDeps,
    timeoutMs: 200,
    ping: async () => {
      const error = new Error("Timed out in server selection after 2000ms");
      error.name = "MongoOperationTimeoutError";
      throw error;
    },
  });

  assert.equal(response.status, 503);
  assert.deepEqual(response.body, {
    status: "error",
    product: "Épistémè",
    phase: 2,
    authEnabled: true,
    accessEnabled: false,
    dependencies: {
      mongodb: { status: "error", error: "mongodb timed out" },
    },
  });
});

test("GET /api/status returns 503 when the MongoDB ping exceeds the timeout", { timeout: 1_500 }, async () => {
  const timeoutMs = 40;
  const started = Date.now();
  const response = await fetchStatus({
    ...baseDeps,
    timeoutMs,
    ping: () => new Promise(() => {}),
  });
  const elapsed = Date.now() - started;

  assert.equal(response.status, 503);
  assert.ok(elapsed < 1_000, `status hung for ${elapsed}ms`);
  assert.deepEqual(response.body, {
    status: "error",
    product: "Épistémè",
    phase: 2,
    authEnabled: true,
    accessEnabled: false,
    dependencies: {
      mongodb: { status: "error", error: "mongodb timed out" },
    },
  });
});

test("the MongoDB admin ping uses a short driver timeout", async () => {
  assert.equal(MONGO_PING_TIMEOUT_MS, 2_000);
  let received: { timeoutMS?: number; maxTimeMS?: number } | undefined;
  await pingAdmin(
    {
      ping(options) {
        received = options;
        return Promise.resolve({ ok: 1 });
      },
    },
    MONGO_PING_TIMEOUT_MS,
  );
  assert.deepEqual(received, { timeoutMS: 2_000, maxTimeMS: 2_000 });
});
