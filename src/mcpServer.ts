/**
 * mcp-agenda-tool — MCP stdio server (Cycle 2)
 *
 * Wraps the existing ToolRegistry in a standard MCP stdio transport so that
 * any MCP-compatible AI agent or client can discover and invoke the four
 * booking tools:
 *
 *   • list_specialists
 *   • get_specialist_availability
 *   • search_appointment_slots
 *   • create_booking_request
 *
 * Usage:
 *   npm run mcp           (ts-node, development)
 *   npm run mcp:start     (compiled dist/, production)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { registry } from "./index";

// ── MCP server instance ────────────────────────────────────────────────────

export const server = new McpServer({
  name: "mcp-agenda-tool",
  version: "0.1.0",
});

// ── Helper — call registry and convert result to MCP content ──────────────

function callTool(
  toolName: string,
  input: unknown
): { content: Array<{ type: "text"; text: string }> } {
  const result = registry.call(toolName, input);
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

// ── Tool: list_specialists ─────────────────────────────────────────────────

server.registerTool(
  "list_specialists",
  {
    description:
      "Returns a list of medical specialists. Optionally filter by specialty, location, modality, or language. " +
      "Valid specialties: CARDIOLOGY, DERMATOLOGY, ENDOCRINOLOGY, GASTROENTEROLOGY, GENERAL_PRACTICE, " +
      "GYNECOLOGY, NEUROLOGY, ONCOLOGY, OPHTHALMOLOGY, ORTHOPEDICS, PEDIATRICS, PSYCHIATRY, " +
      "PULMONOLOGY, RHEUMATOLOGY, UROLOGY. Valid modalities: IN_PERSON, TELEHEALTH. " +
      "Valid languages: SPANISH, ENGLISH, CATALAN.",
    inputSchema: {
      specialty: z
        .string()
        .optional()
        .describe(
          "Medical specialty to filter by (e.g. CARDIOLOGY, PEDIATRICS)"
        ),
      location: z
        .string()
        .optional()
        .describe("Partial case-insensitive match on clinic name"),
      modality: z
        .string()
        .optional()
        .describe("Appointment modality: IN_PERSON or TELEHEALTH"),
      language: z
        .string()
        .optional()
        .describe("Language spoken by the specialist: SPANISH, ENGLISH, or CATALAN"),
    },
  },
  (input) => callTool("list_specialists", input)
);

// ── Tool: get_specialist_availability ──────────────────────────────────────

server.registerTool(
  "get_specialist_availability",
  {
    description:
      "Returns all available appointment slots for a given specialist over the next 14 weekdays.",
    inputSchema: {
      specialistId: z.string().describe("Unique identifier of the specialist"),
    },
  },
  (input) => callTool("get_specialist_availability", input)
);

// ── Tool: search_appointment_slots ─────────────────────────────────────────

server.registerTool(
  "search_appointment_slots",
  {
    description:
      "Searches for available appointment slots. Filter by specialty, location, modality, specialistId, or date range. " +
      "Valid specialties: CARDIOLOGY, DERMATOLOGY, ENDOCRINOLOGY, GASTROENTEROLOGY, GENERAL_PRACTICE, " +
      "GYNECOLOGY, NEUROLOGY, ONCOLOGY, OPHTHALMOLOGY, ORTHOPEDICS, PEDIATRICS, PSYCHIATRY, " +
      "PULMONOLOGY, RHEUMATOLOGY, UROLOGY. Valid modalities: IN_PERSON, TELEHEALTH.",
    inputSchema: {
      specialty: z
        .string()
        .optional()
        .describe("Medical specialty to filter by"),
      location: z.string().optional().describe("Partial match on clinic name"),
      modality: z
        .string()
        .optional()
        .describe("Appointment modality: IN_PERSON or TELEHEALTH"),
      specialistId: z
        .string()
        .optional()
        .describe("Narrow results to a specific specialist"),
      fromDate: z
        .string()
        .optional()
        .describe("Inclusive start date in YYYY-MM-DD format"),
      toDate: z
        .string()
        .optional()
        .describe("Inclusive end date in YYYY-MM-DD format"),
    },
  },
  (input) => callTool("search_appointment_slots", input)
);

// ── Tool: create_booking_request ──────────────────────────────────────────

server.registerTool(
  "create_booking_request",
  {
    description:
      "Creates a new booking request for a medical consultation. Requires patient name, at least one contact " +
      "method (phone or email), specialty, and reason for visit. " +
      "Valid specialties: CARDIOLOGY, DERMATOLOGY, ENDOCRINOLOGY, GASTROENTEROLOGY, GENERAL_PRACTICE, " +
      "GYNECOLOGY, NEUROLOGY, ONCOLOGY, OPHTHALMOLOGY, ORTHOPEDICS, PEDIATRICS, PSYCHIATRY, " +
      "PULMONOLOGY, RHEUMATOLOGY, UROLOGY.",
    inputSchema: {
      patientName: z.string().describe("Full name of the patient"),
      phone: z
        .string()
        .optional()
        .describe(
          "Patient phone number — at least one of phone or email is required"
        ),
      email: z
        .string()
        .optional()
        .describe(
          "Patient email address — at least one of phone or email is required"
        ),
      specialty: z.string().describe("Medical specialty for the booking"),
      reason: z.string().describe("Reason for the consultation"),
      slotId: z
        .string()
        .optional()
        .describe(
          "Pre-selected appointment slot id (mutually exclusive with preferredWindow)"
        ),
      preferredWindow: z
        .object({
          from: z.string().describe("Start date in YYYY-MM-DD format"),
          to: z.string().describe("End date in YYYY-MM-DD format"),
        })
        .optional()
        .describe("Preferred date range when no specific slot is chosen"),
      notes: z.string().optional().describe("Optional operator notes"),
    },
  },
  (input) => callTool("create_booking_request", input)
);

// ── Start server ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // MCP stdio servers must not write anything to stdout other than MCP messages.
  // Informational output goes to stderr.
  process.stderr.write("mcp-agenda-tool MCP server started on stdio\n");
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`Fatal error: ${String(err)}\n`);
    process.exit(1);
  });
}
