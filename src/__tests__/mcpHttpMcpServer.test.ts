/**
 * Integration tests for the MCP-over-HTTP server (src/mcpHttpMcpServer.ts).
 *
 * Sends real JSON-RPC 2.0 MCP messages to the server and validates that the
 * responses follow the MCP protocol (not the custom REST shape).
 *
 * The StreamableHTTPServerTransport responds with Server-Sent Events (SSE)
 * when the client sends Accept: application/json, text/event-stream — which
 * is the correct behaviour for the MCP Streamable HTTP transport.
 *
 * A real http.Server is bound to an ephemeral port (port 0) for each suite
 * so tests are fully isolated and never collide with CI port assignments.
 */

import * as http from "http";
import { createMcpHttpMcpServer } from "../mcpHttpMcpServer";

// ── Helpers ──────────────────────────────────────────────────────────────────

interface TestServer {
  port: number;
  close: () => Promise<void>;
}

function startServer(): Promise<TestServer> {
  return new Promise((resolve, reject) => {
    const server = createMcpHttpMcpServer();
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

/**
 * Parse the first JSON-RPC message out of an SSE body.
 * SSE lines look like:  "data: {\"jsonrpc\":...}\n"
 */
function parseSseBody(raw: string): unknown {
  for (const line of raw.split("\n")) {
    if (line.startsWith("data: ")) {
      return JSON.parse(line.slice(6));
    }
  }
  throw new Error(`No SSE data line found in: ${raw}`);
}

/**
 * POST a JSON-RPC message to the /mcp endpoint.
 * The StreamableHTTPServerTransport requires the Accept header to include
 * both "application/json" and "text/event-stream".
 */
function mcpPost(
  port: number,
  body: unknown
): Promise<{ status: number; contentType: string | undefined; raw: string }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port,
      path: "/mcp",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        // Both must be present — the SDK enforces this for the Streamable HTTP transport
        Accept: "application/json, text/event-stream",
      },
    };
    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode ?? 0,
          contentType: res.headers["content-type"] as string | undefined,
          raw: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function plainGet(
  port: number,
  path: string
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port,
      path,
      method: "GET",
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
    req.end();
  });
}

// ── GET /health ───────────────────────────────────────────────────────────────

describe("MCP HTTP Server — GET /health", () => {
  let srv: TestServer;

  beforeAll(async () => {
    srv = await startServer();
  });

  afterAll(async () => {
    await srv.close();
  });

  it("returns 200 with ok:true", async () => {
    const { status, body } = await plainGet(srv.port, "/health");
    expect(status).toBe(200);
    expect((body as { ok: boolean }).ok).toBe(true);
  });

  it("includes a timestamp", async () => {
    const { body } = await plainGet(srv.port, "/health");
    const ts = (body as { timestamp: string }).timestamp;
    expect(typeof ts).toBe("string");
    expect(new Date(ts).getTime()).not.toBeNaN();
  });
});

// ── Unknown routes ────────────────────────────────────────────────────────────

describe("MCP HTTP Server — unknown routes", () => {
  let srv: TestServer;

  beforeAll(async () => {
    srv = await startServer();
  });

  afterAll(async () => {
    await srv.close();
  });

  it("returns 404 for an unknown path", async () => {
    const { status } = await plainGet(srv.port, "/unknown");
    expect(status).toBe(404);
  });
});

// ── MCP initialize via POST /mcp ──────────────────────────────────────────────

describe("MCP HTTP Server — MCP initialize", () => {
  let srv: TestServer;

  beforeAll(async () => {
    srv = await startServer();
  });

  afterAll(async () => {
    await srv.close();
  });

  it("responds 200 with SSE content-type", async () => {
    const { status, contentType } = await mcpPost(srv.port, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "0.0.1" },
      },
    });

    expect(status).toBe(200);
    expect(contentType).toMatch(/text\/event-stream/);
  });

  it("SSE body contains a valid JSON-RPC 2.0 initialize result", async () => {
    const { raw } = await mcpPost(srv.port, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "0.0.1" },
      },
    });

    const msg = parseSseBody(raw) as Record<string, unknown>;
    expect(msg.jsonrpc).toBe("2.0");
    expect(msg.id).toBe(1);
    expect(msg.result).toBeDefined();
    const result = msg.result as Record<string, unknown>;
    const serverInfo = result.serverInfo as { name: string; version: string };
    expect(serverInfo.name).toBe("mcp-agenda-tool");
  });

  it("returns 406 when Accept header is missing text/event-stream", async () => {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "0.0.1" },
      },
    });

    const { status } = await new Promise<{ status: number }>(
      (resolve, reject) => {
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: srv.port,
            path: "/mcp",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(payload),
              Accept: "application/json", // missing text/event-stream
            },
          },
          (res) => {
            res.resume();
            resolve({ status: res.statusCode ?? 0 });
          }
        );
        req.on("error", reject);
        req.write(payload);
        req.end();
      }
    );

    expect(status).toBe(406);
  });
});

// ── tools/list ────────────────────────────────────────────────────────────────

describe("MCP HTTP Server — tools/list", () => {
  let srv: TestServer;

  beforeAll(async () => {
    srv = await startServer();
  });

  afterAll(async () => {
    await srv.close();
  });

  it("returns exactly four tools as a JSON-RPC 2.0 result", async () => {
    const { raw } = await mcpPost(srv.port, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });

    const msg = parseSseBody(raw) as Record<string, unknown>;
    expect(msg.jsonrpc).toBe("2.0");
    expect(msg.id).toBe(2);
    const result = msg.result as { tools: Array<{ name: string }> };
    expect(Array.isArray(result.tools)).toBe(true);
    const names = result.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "create_booking_request",
      "get_specialist_availability",
      "list_specialists",
      "search_appointment_slots",
    ]);
  });

  it("response does not contain a top-level 'tools' key (not REST format)", async () => {
    const { raw } = await mcpPost(srv.port, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/list",
      params: {},
    });
    const msg = parseSseBody(raw) as Record<string, unknown>;
    // The custom REST server returns { tools: [...] } at the top level.
    // The MCP server MUST NOT do that — tools are nested under result.
    expect(msg.tools).toBeUndefined();
  });
});

// ── tools/call ────────────────────────────────────────────────────────────────

describe("MCP HTTP Server — tools/call list_specialists", () => {
  let srv: TestServer;

  beforeAll(async () => {
    srv = await startServer();
  });

  afterAll(async () => {
    await srv.close();
  });

  it("invokes list_specialists and returns a JSON-RPC 2.0 result", async () => {
    const { status, raw } = await mcpPost(srv.port, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "list_specialists",
        arguments: {},
      },
    });

    expect(status).toBe(200);
    const msg = parseSseBody(raw) as Record<string, unknown>;
    expect(msg.jsonrpc).toBe("2.0");
    expect(msg.id).toBe(4);
    expect(msg.result).toBeDefined();
    const result = msg.result as { content: Array<{ type: string; text: string }> };
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0].type).toBe("text");
    // The text is JSON-serialised tool output — parse and verify structure
    const toolOutput = JSON.parse(result.content[0].text) as {
      success: boolean;
      data: unknown[];
    };
    expect(toolOutput.success).toBe(true);
    expect(toolOutput.data.length).toBeGreaterThan(0);
  });
});

// ── malformed JSON body ───────────────────────────────────────────────────────

describe("MCP HTTP Server — malformed JSON body", () => {
  let srv: TestServer;

  beforeAll(async () => {
    srv = await startServer();
  });

  afterAll(async () => {
    await srv.close();
  });

  it("returns 400 for invalid JSON", async () => {
    const { status } = await new Promise<{ status: number }>(
      (resolve, reject) => {
        const options: http.RequestOptions = {
          hostname: "127.0.0.1",
          port: srv.port,
          path: "/mcp",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": 5,
            Accept: "application/json, text/event-stream",
          },
        };
        const req = http.request(options, (res) => {
          res.resume();
          resolve({ status: res.statusCode ?? 0 });
        });
        req.on("error", reject);
        req.write("{bad}");
        req.end();
      }
    );
    expect(status).toBe(400);
  });
});
