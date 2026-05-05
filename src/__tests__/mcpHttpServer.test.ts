/**
 * Integration tests for the HTTP server transport (src/mcpHttpServer.ts).
 *
 * A real http.Server is bound to an ephemeral port (port 0) for each test
 * suite so the tests are fully isolated and never collide with each other or
 * with CI port assignments.
 */

import * as http from "http";
import { createHttpServer } from "../mcpHttpServer";

// ── Helper ──────────────────────────────────────────────────────────────────

interface TestServer {
  port: number;
  close: () => Promise<void>;
}

function startServer(): Promise<TestServer> {
  return new Promise((resolve, reject) => {
    const server = createHttpServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({
        port: addr.port,
        close: () =>
          new Promise<void>((res, rej) =>
            server.close((err) => (err ? rej(err) : res()))
          ),
      });
    });
    server.once("error", reject);
  });
}

function request(
  port: number,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const payload =
      body !== undefined ? JSON.stringify(body) : undefined;

    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(payload
          ? { "Content-Length": Buffer.byteLength(payload) }
          : {}),
      },
    };

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        try {
          resolve({
            status: res.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
          });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── GET /health ──────────────────────────────────────────────────────────────

describe("HTTP Server — GET /health", () => {
  let srv: TestServer;

  beforeAll(async () => {
    srv = await startServer();
  });

  afterAll(async () => {
    await srv.close();
  });

  it("returns 200 with ok:true", async () => {
    const { status, body } = await request(srv.port, "GET", "/health");
    expect(status).toBe(200);
    expect((body as { ok: boolean }).ok).toBe(true);
  });

  it("includes a timestamp", async () => {
    const { body } = await request(srv.port, "GET", "/health");
    const ts = (body as { timestamp: string }).timestamp;
    expect(typeof ts).toBe("string");
    expect(new Date(ts).getTime()).not.toBeNaN();
  });
});

// ── GET /tools ───────────────────────────────────────────────────────────────

describe("HTTP Server — GET /tools", () => {
  let srv: TestServer;

  beforeAll(async () => {
    srv = await startServer();
  });

  afterAll(async () => {
    await srv.close();
  });

  it("returns 200 with a tools array", async () => {
    const { status, body } = await request(srv.port, "GET", "/tools");
    expect(status).toBe(200);
    const tools = (body as { tools: Array<{ name: string; description: string }> }).tools;
    expect(Array.isArray(tools)).toBe(true);
  });

  it("lists exactly four tools", async () => {
    const { body } = await request(srv.port, "GET", "/tools");
    const tools = (body as { tools: Array<{ name: string }> }).tools;
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "create_booking_request",
      "get_specialist_availability",
      "list_specialists",
      "search_appointment_slots",
    ]);
  });

  it("each tool has a name and description", async () => {
    const { body } = await request(srv.port, "GET", "/tools");
    const tools = (body as { tools: Array<{ name: string; description: string }> }).tools;
    for (const tool of tools) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });
});

// ── POST /tools/list_specialists ─────────────────────────────────────────────

describe("HTTP Server — POST /tools/list_specialists", () => {
  let srv: TestServer;

  beforeAll(async () => {
    srv = await startServer();
  });

  afterAll(async () => {
    await srv.close();
  });

  it("returns all specialists with empty body", async () => {
    const { status, body } = await request(
      srv.port,
      "POST",
      "/tools/list_specialists",
      {}
    );
    expect(status).toBe(200);
    const parsed = body as { success: boolean; data: unknown[] };
    expect(parsed.success).toBe(true);
    expect(parsed.data.length).toBe(10);
  });

  it("filters by specialty", async () => {
    const { body } = await request(
      srv.port,
      "POST",
      "/tools/list_specialists",
      { specialty: "CARDIOLOGY" }
    );
    const parsed = body as { success: boolean; data: Array<{ specialty: string }> };
    expect(parsed.success).toBe(true);
    expect(parsed.data.length).toBe(1);
    expect(parsed.data[0].specialty).toBe("CARDIOLOGY");
  });

  it("returns 422 for invalid specialty", async () => {
    const { status, body } = await request(
      srv.port,
      "POST",
      "/tools/list_specialists",
      { specialty: "MAGIC" }
    );
    expect(status).toBe(422);
    const parsed = body as { success: boolean; error: string };
    expect(parsed.success).toBe(false);
    expect(parsed.error).toMatch(/Invalid specialty/);
  });
});

// ── POST /tools/get_specialist_availability ───────────────────────────────────

describe("HTTP Server — POST /tools/get_specialist_availability", () => {
  let srv: TestServer;

  beforeAll(async () => {
    srv = await startServer();
  });

  afterAll(async () => {
    await srv.close();
  });

  it("returns slots for a valid specialist", async () => {
    const { status, body } = await request(
      srv.port,
      "POST",
      "/tools/get_specialist_availability",
      { specialistId: "spec-001" }
    );
    expect(status).toBe(200);
    const parsed = body as { success: boolean; data: unknown[] };
    expect(parsed.success).toBe(true);
    expect(parsed.data.length).toBeGreaterThan(0);
  });

  it("returns 422 for unknown specialist", async () => {
    const { status, body } = await request(
      srv.port,
      "POST",
      "/tools/get_specialist_availability",
      { specialistId: "does-not-exist" }
    );
    expect(status).toBe(422);
    const parsed = body as { success: boolean; error: string };
    expect(parsed.success).toBe(false);
    expect(parsed.error).toMatch(/not found/);
  });
});

// ── POST /tools/search_appointment_slots ────────────────────────────────────

describe("HTTP Server — POST /tools/search_appointment_slots", () => {
  let srv: TestServer;

  beforeAll(async () => {
    srv = await startServer();
  });

  afterAll(async () => {
    await srv.close();
  });

  it("returns slots with no filter", async () => {
    const { status, body } = await request(
      srv.port,
      "POST",
      "/tools/search_appointment_slots",
      {}
    );
    expect(status).toBe(200);
    const parsed = body as { success: boolean; data: unknown[] };
    expect(parsed.success).toBe(true);
    expect(parsed.data.length).toBeGreaterThan(0);
  });

  it("filters by specialty and modality", async () => {
    const { status, body } = await request(
      srv.port,
      "POST",
      "/tools/search_appointment_slots",
      { specialty: "CARDIOLOGY", modality: "TELEHEALTH" }
    );
    expect(status).toBe(200);
    const parsed = body as { success: boolean };
    expect(parsed.success).toBe(true);
  });
});

// ── POST /tools/create_booking_request ───────────────────────────────────────

describe("HTTP Server — POST /tools/create_booking_request", () => {
  let srv: TestServer;

  beforeAll(async () => {
    srv = await startServer();
  });

  afterAll(async () => {
    await srv.close();
  });

  it("creates a booking request successfully", async () => {
    const { status, body } = await request(
      srv.port,
      "POST",
      "/tools/create_booking_request",
      {
        patientName: "María González",
        email: "maria.gonzalez@email.com",
        specialty: "CARDIOLOGY",
        reason: "Palpitations",
      }
    );
    expect(status).toBe(200);
    const parsed = body as {
      success: boolean;
      data: { patientName: string; status: string };
    };
    expect(parsed.success).toBe(true);
    expect(parsed.data.patientName).toBe("María González");
    expect(parsed.data.status).toBe("PENDING_CONFIRMATION");
  });

  it("returns 422 when no contact method provided", async () => {
    const { status, body } = await request(
      srv.port,
      "POST",
      "/tools/create_booking_request",
      {
        patientName: "Test Patient",
        specialty: "CARDIOLOGY",
        reason: "Check",
      }
    );
    expect(status).toBe(422);
    const parsed = body as { success: boolean; error: string };
    expect(parsed.success).toBe(false);
    expect(parsed.error).toMatch(/contact method/);
  });
});

// ── Unknown routes ────────────────────────────────────────────────────────────

describe("HTTP Server — unknown routes", () => {
  let srv: TestServer;

  beforeAll(async () => {
    srv = await startServer();
  });

  afterAll(async () => {
    await srv.close();
  });

  it("returns 404 for an unknown GET path", async () => {
    const { status } = await request(srv.port, "GET", "/unknown");
    expect(status).toBe(404);
  });

  it("returns 404 for a POST to an unknown tool name", async () => {
    const { status, body } = await request(
      srv.port,
      "POST",
      "/tools/does_not_exist",
      {}
    );
    expect(status).toBe(404);
    const parsed = body as { success: boolean; error: string };
    expect(parsed.success).toBe(false);
    expect(parsed.error).toMatch(/Unknown tool/);
  });

  it("returns 400 for a POST with malformed JSON", async () => {
    const { status, body } = await new Promise<{ status: number; body: unknown }>(
      (resolve, reject) => {
        const options: http.RequestOptions = {
          hostname: "127.0.0.1",
          port: srv.port,
          path: "/tools/list_specialists",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": 5,
          },
        };
        const req = http.request(options, (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => {
            resolve({
              status: res.statusCode ?? 0,
              body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
            });
          });
        });
        req.on("error", reject);
        req.write("{bad}");
        req.end();
      }
    );
    expect(status).toBe(400);
    const parsed = body as { success: boolean; error: string };
    expect(parsed.success).toBe(false);
    expect(parsed.error).toMatch(/Invalid JSON/);
  });
});
