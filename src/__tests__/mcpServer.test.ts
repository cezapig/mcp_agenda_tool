/**
 * Integration tests for the MCP stdio server (src/mcpServer.ts).
 *
 * Uses an InMemoryTransport pair so there is no I/O involved — the server
 * and a real MCP Client are wired together inside the same process.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { server } from "../mcpServer";

// ── Helper ──────────────────────────────────────────────────────────────────

async function buildConnectedClient(): Promise<Client> {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);

  const client = new Client({ name: "test-client", version: "0.0.1" });
  await client.connect(clientTransport);
  return client;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("MCP Server — tool discovery", () => {
  let client: Client;

  beforeAll(async () => {
    client = await buildConnectedClient();
  });

  afterAll(async () => {
    await client.close();
  });

  it("lists exactly four tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "create_booking_request",
      "get_specialist_availability",
      "list_specialists",
      "search_appointment_slots",
    ]);
  });

  it("each tool has a name and description", async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe("string");
      expect(tool.description!.length).toBeGreaterThan(0);
    }
  });
});

describe("MCP Server — list_specialists", () => {
  let client: Client;

  beforeAll(async () => {
    client = await buildConnectedClient();
  });

  afterAll(async () => {
    await client.close();
  });

  it("returns all specialists with no filter", async () => {
    const result = await client.callTool({ name: "list_specialists", arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.success).toBe(true);
    expect(parsed.data.length).toBe(10);
  });

  it("filters by specialty", async () => {
    const result = await client.callTool({
      name: "list_specialists",
      arguments: { specialty: "CARDIOLOGY" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.success).toBe(true);
    expect(parsed.data.length).toBe(1);
    expect(parsed.data[0].specialty).toBe("CARDIOLOGY");
  });

  it("returns error for invalid specialty", async () => {
    const result = await client.callTool({
      name: "list_specialists",
      arguments: { specialty: "MAGIC" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toMatch(/Invalid specialty/);
  });
});

describe("MCP Server — get_specialist_availability", () => {
  let client: Client;

  beforeAll(async () => {
    client = await buildConnectedClient();
  });

  afterAll(async () => {
    await client.close();
  });

  it("returns slots for a valid specialist", async () => {
    const result = await client.callTool({
      name: "get_specialist_availability",
      arguments: { specialistId: "spec-001" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.success).toBe(true);
    expect(Array.isArray(parsed.data)).toBe(true);
    expect(parsed.data.length).toBeGreaterThan(0);
  });

  it("returns error for unknown specialist", async () => {
    const result = await client.callTool({
      name: "get_specialist_availability",
      arguments: { specialistId: "does-not-exist" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toMatch(/not found/);
  });
});

describe("MCP Server — search_appointment_slots", () => {
  let client: Client;

  beforeAll(async () => {
    client = await buildConnectedClient();
  });

  afterAll(async () => {
    await client.close();
  });

  it("returns slots with no filter", async () => {
    const result = await client.callTool({
      name: "search_appointment_slots",
      arguments: {},
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.success).toBe(true);
    expect(Array.isArray(parsed.data)).toBe(true);
    expect(parsed.data.length).toBeGreaterThan(0);
  });

  it("filters by specialty and modality", async () => {
    const result = await client.callTool({
      name: "search_appointment_slots",
      arguments: { specialty: "CARDIOLOGY", modality: "TELEHEALTH" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.success).toBe(true);
  });
});

describe("MCP Server — create_booking_request", () => {
  let client: Client;

  beforeAll(async () => {
    client = await buildConnectedClient();
  });

  afterAll(async () => {
    await client.close();
  });

  it("creates a booking request successfully", async () => {
    const result = await client.callTool({
      name: "create_booking_request",
      arguments: {
        patientName: "María González",
        email: "maria.gonzalez@email.com",
        specialty: "CARDIOLOGY",
        reason: "Palpitations",
      },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.success).toBe(true);
    expect(parsed.data.patientName).toBe("María González");
    expect(parsed.data.status).toBe("PENDING_CONFIRMATION");
  });

  it("returns error when no contact method provided", async () => {
    const result = await client.callTool({
      name: "create_booking_request",
      arguments: {
        patientName: "Test Patient",
        specialty: "CARDIOLOGY",
        reason: "Check",
      },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toMatch(/contact method/);
  });
});
