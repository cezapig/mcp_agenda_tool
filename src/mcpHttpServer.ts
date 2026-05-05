/**
 * mcp-agenda-tool — HTTP server transport
 *
 * Exposes the existing ToolRegistry over a plain HTTP interface so the
 * service can be tunnelled through ngrok (or any reverse proxy).
 *
 * Endpoints:
 *   GET  /health          — liveness check
 *   GET  /tools           — list available tools and their descriptions
 *   POST /tools/:name     — invoke a tool with a JSON body
 *
 * Configuration:
 *   PORT  (env)  — TCP port to listen on (default: 3000)
 *
 * Usage:
 *   npm run http            (ts-node, development)
 *   npm run http:start      (compiled dist/, production)
 *
 * Then expose with ngrok:
 *   ngrok http 3000
 */

import * as http from "http";
import { registry } from "./index";

// ── Types ─────────────────────────────────────────────────────────────────

interface JsonBody {
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<JsonBody> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as JsonBody);
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

// ── Request handler ───────────────────────────────────────────────────────

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const method = req.method ?? "GET";
  const url = req.url ?? "/";

  // GET /health
  if (method === "GET" && url === "/health") {
    sendJson(res, 200, { ok: true, timestamp: new Date().toISOString() });
    return;
  }

  // GET /tools
  if (method === "GET" && url === "/tools") {
    sendJson(res, 200, { tools: registry.listTools() });
    return;
  }

  // POST /tools/:name
  const toolMatch = /^\/tools\/([^/?#]+)$/.exec(url);
  if (method === "POST" && toolMatch) {
    const toolName = decodeURIComponent(toolMatch[1]);

    // Verify tool exists before reading body
    if (!registry.get(toolName)) {
      sendJson(res, 404, {
        success: false,
        error: `Unknown tool: "${toolName}"`,
      });
      return;
    }

    let body: JsonBody;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { success: false, error: "Invalid JSON body" });
      return;
    }

    const result = registry.call(toolName, body);
    const status = result.success ? 200 : 422;
    sendJson(res, status, result);
    return;
  }

  // 404 for everything else
  sendJson(res, 404, { success: false, error: "Not found" });
}

// ── Server factory (exported for testing) ─────────────────────────────────

export function createHttpServer(): http.Server {
  return http.createServer((req, res) => {
    handleRequest(req, res).catch((err: unknown) => {
      process.stderr.write(`Unhandled error: ${String(err)}\n`);
      if (!res.headersSent) {
        sendJson(res, 500, {
          success: false,
          error: "Internal server error",
        });
      }
    });
  });
}

// ── Entry point ───────────────────────────────────────────────────────────

if (require.main === module) {
  const port = parseInt(process.env.PORT ?? "3000", 10);
  const server = createHttpServer();
  server.listen(port, () => {
    process.stderr.write(
      `mcp-agenda-tool HTTP server listening on port ${port}\n`
    );
    process.stderr.write(
      `  Expose with ngrok: ngrok http ${port}\n`
    );
  });
}
