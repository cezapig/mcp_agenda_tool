/**
 * mcp-agenda-tool — Remote MCP over HTTP server
 *
 * Exposes the existing tool registry as a real MCP endpoint over HTTP, using
 * the SDK's StreamableHTTPServerTransport (stateless mode).  Remote MCP
 * clients — such as n8n — connect to this server instead of the stdio server
 * and communicate using the standard MCP / JSON-RPC 2.0 protocol.
 *
 * Endpoint:
 *   POST /mcp   — MCP JSON-RPC messages (initialize, tools/list, tools/call …)
 *   GET  /mcp   — SSE upgrade for server-initiated notifications (optional)
 *   GET  /health — liveness probe
 *
 * Configuration:
 *   MCP_PORT  (env)  — TCP port to listen on (default: 3002)
 *
 * Usage:
 *   npm run mcp:http            (ts-node, development)
 *   npm run mcp:http:start      (compiled dist/, production)
 *
 * Then expose with ngrok and point n8n at:
 *   http://<ngrok-url>/mcp
 */

import * as http from "http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./mcpServer";

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

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
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

  // GET /health — liveness probe
  if (method === "GET" && url === "/health") {
    sendJson(res, 200, { ok: true, timestamp: new Date().toISOString() });
    return;
  }

  // MCP endpoint — both GET (SSE) and POST (JSON-RPC) are handled by the transport
  if (url === "/mcp" || url.startsWith("/mcp?")) {
    // Stateless mode: create a new McpServer + transport per request so every
    // request is fully independent (no session state to manage).
    const mcpServer = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });

    try {
      await mcpServer.connect(transport);

      // For POST we need to pre-parse the body and pass it as parsedBody
      // because the transport reads it via the Web Standard Request adapter.
      let parsedBody: unknown;
      if (method === "POST") {
        try {
          parsedBody = await readBody(req);
        } catch {
          sendJson(res, 400, {
            jsonrpc: "2.0",
            error: { code: -32700, message: "Parse error: invalid JSON body" },
            id: null,
          });
          return;
        }
      }

      await transport.handleRequest(req, res, parsedBody);
    } finally {
      // Clean up after the response has been sent
      res.on("close", () => {
        transport.close().catch(() => {
          // ignore close errors
        });
        mcpServer.close().catch(() => {
          // ignore close errors
        });
      });
    }
    return;
  }

  // 404 for everything else
  sendJson(res, 404, { success: false, error: "Not found" });
}

// ── Server factory (exported for testing) ─────────────────────────────────

export function createMcpHttpMcpServer(): http.Server {
  return http.createServer((req, res) => {
    handleRequest(req, res).catch((err: unknown) => {
      process.stderr.write(`Unhandled error: ${String(err)}\n`);
      if (!res.headersSent) {
        sendJson(res, 500, {
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    });
  });
}

// ── Entry point ───────────────────────────────────────────────────────────

if (require.main === module) {
  const port = parseInt(process.env.MCP_PORT ?? "3002", 10);
  const server = createMcpHttpMcpServer();
  server.listen(port, () => {
    process.stderr.write(
      `mcp-agenda-tool MCP-over-HTTP server listening on port ${port}\n`
    );
    process.stderr.write(
      `  MCP endpoint: http://localhost:${port}/mcp\n`
    );
    process.stderr.write(
      `  Expose with ngrok: ngrok http ${port}\n`
    );
    process.stderr.write(
      `  Point n8n at: https://<ngrok-url>/mcp\n`
    );
  });
}
