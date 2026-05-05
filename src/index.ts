/**
 * mcp-agenda-tool — main entry point
 *
 * Initialises the in-memory agenda provider, registers all MCP-style tools,
 * and exports the registry for use by any transport layer (stdio, HTTP, etc.).
 */

import { InMemoryAgendaProvider } from "./providers";
import { ToolRegistry } from "./tools/registry";
import {
  createListSpecialistsTool,
  createGetSpecialistAvailabilityTool,
  createSearchAppointmentSlotsTool,
  createBookingRequestTool,
} from "./tools";

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const provider = new InMemoryAgendaProvider();

export const registry = new ToolRegistry();

registry.register(createListSpecialistsTool(provider));
registry.register(createGetSpecialistAvailabilityTool(provider));
registry.register(createSearchAppointmentSlotsTool(provider));
registry.register(createBookingRequestTool(provider));

// ── CLI entry-point ───────────────────────────────────────────────────────────
// When run directly (ts-node src/index.ts), print a summary of available tools.

if (require.main === module) {
  console.log("mcp-agenda-tool is running\n");
  console.log("Registered tools:");
  for (const tool of registry.listTools()) {
    console.log(`  • ${tool.name} — ${tool.description}`);
  }
  console.log("\nProvider is ready with seeded in-memory data.");
  console.log('Run `npm run demo` to see example tool calls.\n');
}

export { InMemoryAgendaProvider };
export type { AgendaProvider } from "./providers";
