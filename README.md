# mcp-agenda-tool

> **Mock MCP server for a medical booking agenda simulator**

A Node.js + TypeScript project that simulates a medical consultation booking system in the style of an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) tool server. It provides a clean, in-memory agenda with realistic Spanish-context seed data and a structured tool API that can be wired into any transport layer.

---

## Table of Contents

1. [Purpose](#purpose)
2. [Architecture Overview](#architecture-overview)
3. [Project Structure](#project-structure)
4. [Quick Start](#quick-start)
5. [MCP stdio Server](#mcp-stdio-server)
6. [Tool Contract](#tool-contract)
6. [Domain Model](#domain-model)
7. [Backend Domain Proposal](#backend-domain-proposal)
8. [Frontend Operator Flow](#frontend-operator-flow)
9. [MVP Delivery Cycles](#mvp-delivery-cycles)
10. [How This Fits the Broader Workflow](#how-this-fits-the-broader-workflow)

---

## Purpose

`mcp-agenda-tool` is a **mock scheduling adapter layer** for a medical consultation booking agent. It simulates:

- Medical specialists with specialties, languages, and locations
- Available appointment slots generated for the next 14 weekdays
- Booking request creation with patient contact details

The backend remains the **source of truth** for business data. This repo acts as an **MCP-style tool surface** that an AI agent (or any orchestration layer) can call to discover availability and create booking requests.

---

## Architecture Overview

```
+-------------------------------------------------------------+
|                      AI Booking Agent                       |
|       (LLM + orchestration -- e.g. n8n, LangChain)         |
+-----------------------------+-------------------------------+
                              | MCP-style tool calls
                              v
+-------------------------------------------------------------+
|                   mcp-agenda-tool (this repo)               |
|                                                             |
|  ToolRegistry                                               |
|  +--------------------------------------------------+      |
|  |  list_specialists                                |      |
|  |  get_specialist_availability                     |      |
|  |  search_appointment_slots                        |      |
|  |  create_booking_request                          |      |
|  +--------------------------------------------------+      |
|                        |                                    |
|               AgendaProvider (interface)                    |
|                        |                                    |
|          InMemoryAgendaProvider (MVP impl.)                 |
|          [Slot generation * Seed data * BookingRequests]    |
+-------------------------------------------------------------+
                          | (future) real backend adapter
                          v
          +-------------------------------+
          |    Real Clinic Backend API    |
          |  (PostgreSQL * REST * GraphQL)|
          +-------------------------------+
```

**Key architectural decisions:**

- `AgendaProvider` is a stable interface. Swap `InMemoryAgendaProvider` for a real HTTP adapter without changing any tool logic.
- `ToolRegistry` is transport-agnostic. Register the same tools for stdio, HTTP, or WebSocket transports.
- All tools return `{ success: true, data }` or `{ success: false, error }` — easy to serialise to JSON for any wire protocol.

---

## Project Structure

```
mcp_agenda_tool/
├── src/
│   ├── index.ts                  # Entry point -- bootstraps registry
│   ├── mcpServer.ts              # MCP stdio server (Cycle 2)
│   ├── demo.ts                   # Interactive demo of all tools
│   ├── domain/
│   │   ├── models.ts             # Core domain interfaces & enums
│   │   └── index.ts
│   ├── data/
│   │   ├── specialists.ts        # Seed specialist data
│   │   └── index.ts
│   ├── providers/
│   │   ├── AgendaProvider.ts     # Interface + filter/input types
│   │   ├── InMemoryAgendaProvider.ts
│   │   └── index.ts
│   ├── tools/
│   │   ├── registry.ts           # ToolRegistry + Tool<I,O> types
│   │   ├── listSpecialists.ts
│   │   ├── getSpecialistAvailability.ts
│   │   ├── searchAppointmentSlots.ts
│   │   ├── createBookingRequest.ts
│   │   └── index.ts
│   ├── utils/
│   │   ├── date.ts               # Date helpers, validation helpers
│   │   └── index.ts
│   └── __tests__/
│       ├── InMemoryAgendaProvider.test.ts
│       ├── mcpServer.test.ts
│       └── tools.test.ts
├── package.json
├── tsconfig.json
├── jest.config.json
├── .eslintrc.json
├── .gitignore
└── README.md
```

---

## Quick Start

### Prerequisites

- Node.js >= 18
- npm >= 9

### Install

```bash
npm install
```

### Build

```bash
npm run build
# Output: dist/
```

### Run (entry point)

```bash
npm start          # runs compiled dist/index.js
# or
npm run dev        # runs ts-node src/index.ts directly
```

### Demo -- see all tools in action

```bash
npm run demo
```

### Test

```bash
npm test
```

### Lint

```bash
npm run lint
```

---

## MCP stdio Server

`src/mcpServer.ts` wraps the existing `ToolRegistry` in a standard [MCP](https://modelcontextprotocol.io/) stdio transport. Any MCP-compatible AI agent or client can connect to this server, list the four tools, and invoke them against the seeded in-memory data.

### Start the server

**Development (ts-node):**

```bash
npm run mcp
```

**Production (compiled):**

```bash
npm run build
npm run mcp:start
```

The server reads JSON-RPC messages from `stdin` and writes responses to `stdout` following the MCP stdio transport protocol. Startup status is written to `stderr`:

```
mcp-agenda-tool MCP server started on stdio
```

### Connecting an MCP client

The server exposes the following tools:

| Tool name                      | Description                                              |
|-------------------------------|----------------------------------------------------------|
| `list_specialists`             | List specialists, optionally filtered                    |
| `get_specialist_availability`  | Get available slots for a specialist (next 14 weekdays)  |
| `search_appointment_slots`     | Search slots across all specialists with flexible filters|
| `create_booking_request`       | Create a booking request (PENDING_CONFIRMATION)          |

#### Claude Desktop / Claude.app

Add the following to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "mcp-agenda-tool": {
      "command": "node",
      "args": ["/absolute/path/to/mcp_agenda_tool/dist/mcpServer.js"]
    }
  }
}
```

Or with ts-node for development:

```json
{
  "mcpServers": {
    "mcp-agenda-tool": {
      "command": "npx",
      "args": ["ts-node", "/absolute/path/to/mcp_agenda_tool/src/mcpServer.ts"]
    }
  }
}
```

#### Manual end-to-end test with `@modelcontextprotocol/inspector`

```bash
npx @modelcontextprotocol/inspector node dist/mcpServer.js
```

This opens a browser-based inspector where you can list tools and call them interactively.

### Example end-to-end booking flow

The following sequence shows a typical AI agent booking flow:

**Step 1 — Find a cardiologist available for telehealth**

```json
{
  "tool": "list_specialists",
  "arguments": { "specialty": "CARDIOLOGY", "modality": "TELEHEALTH" }
}
```

Response: returns specialist(s) with id, name, locations, etc.

**Step 2 — Check availability for the specialist**

```json
{
  "tool": "get_specialist_availability",
  "arguments": { "specialistId": "spec-001" }
}
```

Response: returns available slots with ids, dates, start/end times.

**Step 3 — Search for a slot in a specific date range**

```json
{
  "tool": "search_appointment_slots",
  "arguments": {
    "specialty": "CARDIOLOGY",
    "modality": "TELEHEALTH",
    "fromDate": "2025-06-02",
    "toDate": "2025-06-06"
  }
}
```

**Step 4 — Create a booking request**

```json
{
  "tool": "create_booking_request",
  "arguments": {
    "patientName": "María González",
    "email": "maria.gonzalez@email.com",
    "phone": "+34 612 345 678",
    "specialty": "CARDIOLOGY",
    "reason": "Palpitations and shortness of breath",
    "slotId": "<slot-id-from-step-2>"
  }
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "...",
    "patientName": "María González",
    "contact": { "email": "maria.gonzalez@email.com", "phone": "+34 612 345 678" },
    "specialty": "CARDIOLOGY",
    "reason": "Palpitations and shortness of breath",
    "slotId": "...",
    "status": "PENDING_CONFIRMATION",
    "createdAt": "..."
  }
}
```

---

All tools follow this result shape:

```typescript
type ToolResult<T> =
  | { success: true;  data: T }
  | { success: false; error: string }
```

### list_specialists

Returns medical specialists, optionally filtered.

**Input**

| Field       | Type   | Required | Description                                      |
|-------------|--------|----------|--------------------------------------------------|
| `specialty` | string | No       | Enum value -- see Specialty reference below      |
| `location`  | string | No       | Partial case-insensitive match on clinic names   |
| `modality`  | string | No       | `IN_PERSON` or `TELEHEALTH`                      |
| `language`  | string | No       | `SPANISH`, `ENGLISH`, or `CATALAN`               |

**Example request**

```json
{ "specialty": "CARDIOLOGY", "modality": "TELEHEALTH" }
```

**Example response**

```json
{
  "success": true,
  "data": [
    {
      "id": "spec-001",
      "name": "Dra. Elena Martínez",
      "specialty": "CARDIOLOGY",
      "locations": ["Clínica Central Madrid", "Clínica Norte Madrid"],
      "modalities": ["IN_PERSON", "TELEHEALTH"],
      "languages": ["SPANISH", "ENGLISH"],
      "bio": "Cardióloga con 15 años de experiencia en cardiología intervencionista y preventiva."
    }
  ]
}
```

---

### get_specialist_availability

Returns all available slots for a given specialist over the next 14 days.

**Input**

| Field          | Type   | Required | Description        |
|----------------|--------|----------|--------------------|
| `specialistId` | string | Yes      | Specialist id      |

**Example request**

```json
{ "specialistId": "spec-001" }
```

**Example response**

```json
{
  "success": true,
  "data": [
    {
      "id": "a1b2c3d4-...",
      "specialistId": "spec-001",
      "date": "2025-06-02",
      "startTime": "09:00",
      "endTime": "09:30",
      "modality": "IN_PERSON",
      "location": "Clínica Central Madrid",
      "status": "AVAILABLE"
    }
  ]
}
```

---

### search_appointment_slots

Searches available slots across all specialists with flexible filters.

**Input**

| Field          | Type   | Required | Description                          |
|----------------|--------|----------|--------------------------------------|
| `specialty`    | string | No       | Filter by specialist specialty        |
| `location`     | string | No       | Partial match on clinic name          |
| `modality`     | string | No       | `IN_PERSON` or `TELEHEALTH`           |
| `specialistId` | string | No       | Narrow to a single specialist         |
| `fromDate`     | string | No       | YYYY-MM-DD inclusive lower bound      |
| `toDate`       | string | No       | YYYY-MM-DD inclusive upper bound      |

**Example request**

```json
{
  "specialty": "PEDIATRICS",
  "modality": "IN_PERSON",
  "fromDate": "2025-06-02",
  "toDate": "2025-06-06"
}
```

---

### create_booking_request

Creates a new booking request with status `PENDING_CONFIRMATION`.

**Input**

| Field             | Type   | Required | Description                                           |
|-------------------|--------|----------|-------------------------------------------------------|
| `patientName`     | string | Yes      | Full patient name                                     |
| `phone`           | string | No*      | Patient phone -- at least one of phone/email required |
| `email`           | string | No*      | Patient email -- at least one of phone/email required |
| `specialty`       | string | Yes      | Medical specialty enum value                          |
| `reason`          | string | Yes      | Reason for consultation                               |
| `slotId`          | string | No       | Pre-selected slot id (validated against available slots) |
| `preferredWindow` | object | No       | `{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" }`       |
| `notes`           | string | No       | Operator notes                                        |

\* At least one contact method (phone or email) is required.

**Example request**

```json
{
  "patientName": "María González",
  "email": "maria.gonzalez@email.com",
  "phone": "+34 612 345 678",
  "specialty": "GENERAL_PRACTICE",
  "reason": "Revisión anual y control de tensión arterial",
  "slotId": "a1b2c3d4-..."
}
```

**Example response**

```json
{
  "success": true,
  "data": {
    "id": "c22995d2-...",
    "patientName": "María González",
    "contact": {
      "phone": "+34 612 345 678",
      "email": "maria.gonzalez@email.com"
    },
    "specialty": "GENERAL_PRACTICE",
    "reason": "Revisión anual y control de tensión arterial",
    "slotId": "a1b2c3d4-...",
    "status": "PENDING_CONFIRMATION",
    "createdAt": "2025-06-02T10:30:00.000Z"
  }
}
```

**Validation error response**

```json
{
  "success": false,
  "error": "At least one contact method is required: phone or email."
}
```

---

## Domain Model

```typescript
enum Specialty  { CARDIOLOGY, DERMATOLOGY, ENDOCRINOLOGY, ... }
enum Modality   { IN_PERSON, TELEHEALTH }
enum SlotStatus { AVAILABLE, BOOKED, BLOCKED }
enum BookingRequestStatus { PENDING_CONFIRMATION, CONFIRMED, CANCELLED, COMPLETED }
enum Language   { SPANISH, ENGLISH, CATALAN }

interface Specialist {
  id: string;
  name: string;
  specialty: Specialty;
  locations: string[];
  modalities: Modality[];
  languages: Language[];
  bio: string;
}

interface Slot {
  id: string;
  specialistId: string;
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:MM (24h)
  endTime: string;       // HH:MM (24h)
  modality: Modality;
  location: string | null;
  status: SlotStatus;
}

interface BookingRequest {
  id: string;
  patientName: string;
  contact: { phone?: string; email?: string };
  specialty: Specialty;
  reason: string;
  slotId?: string;
  preferredWindow?: { from: string; to: string };
  status: BookingRequestStatus;
  createdAt: string;     // ISO timestamp
  notes?: string;
}
```

---

## Backend Domain Proposal

When this mock adapter evolves into a real system, the backend should own:

| Entity               | Key Fields                                                      |
|----------------------|-----------------------------------------------------------------|
| `Tenant`             | id, name, config (multi-clinic support)                         |
| `Specialist`         | id, tenantId, name, specialty, licenseNumber, bio               |
| `SpecialistSchedule` | specialistId, weekday, startTime, endTime, modality, location   |
| `Slot`               | id, specialistId, datetime, modality, locationId, status        |
| `BookingRequest`     | id, patientId, slotId, specialty, reason, contact, status       |
| `Patient`            | id, name, dateOfBirth, contactMethods[], healthcareId           |
| `Location`           | id, tenantId, name, address, city                               |
| `AuditLog`           | entityType, entityId, actorId, action, timestamp, diff          |

**Status transitions for BookingRequest:**

```
PENDING_CONFIRMATION
       |
       +---> CONFIRMED ---> COMPLETED
       |
       +---> CANCELLED
```

**Privacy / PHI considerations:**

- Patient name and contact are PII -- encrypt at rest or use tokenisation.
- Audit log every status change with actor id and timestamp.
- Do not log free-text reason fields in aggregate analytics.

---

## Frontend Operator Flow

The frontend is **downstream** of booking request creation. It supports human schedulers reviewing AI-generated booking requests.

### Operator Inbox

```
+------------------------------------------------------+
|  Booking Requests -- Inbox                [Filters v]|
|                                                      |
|  * PENDING   María González    CARDIOLOGY    09:15   |
|  * PENDING   Juan Pérez        GENERAL_PRACT 08:50   |
|  o CONFIRMED Ana Torres        DERMATOLOGY   -       |
+------------------------------------------------------+
```

### Operator Actions per Request

1. **Review** -- read patient name, contact, specialty, reason
2. **Select / change slot** -- search availability, assign slot
3. **Confirm** -- transition status to CONFIRMED, triggers notification
4. **Request info** -- mark as NEEDS_INFO, route back to agent
5. **Cancel** -- transition to CANCELLED with reason

### Key Frontend Components (MVP)

| Component             | Purpose                                           |
|-----------------------|---------------------------------------------------|
| `BookingInbox`        | Paginated list of requests, filterable by status  |
| `BookingDetail`       | Full request view with contact + reason           |
| `SlotSelector`        | Embedded availability search                      |
| `StatusBadge`         | Colour-coded booking status                       |
| `OperatorActionPanel` | Confirm / Cancel / Assign buttons                 |

---

## MVP Delivery Cycles

### Cycle 1 -- Foundation (this PR)
- [x] TypeScript project scaffold
- [x] Domain models
- [x] In-memory provider with seed data
- [x] Tool registry + 4 core tools
- [x] Tests (44 passing) + demo

### Cycle 2 -- Agent Integration
- [x] Wire ToolRegistry to stdio MCP transport (`src/mcpServer.ts`, `npm run mcp`)
- [ ] Connect AI booking agent (LLM + orchestrator) to tool surface
- [ ] Add NEEDS_HUMAN escalation signal to tool responses
- [ ] Enrich booking request with agent conversation context

### Cycle 3 -- Operator Frontend (MVP)
- [ ] Booking inbox page with status filter
- [ ] Booking detail with slot assignment
- [ ] Confirm / Cancel actions
- [ ] Real-time updates via WebSocket or polling

### Cycle 4 -- Real Backend Adapter
- [ ] Replace InMemoryAgendaProvider with REST/GraphQL client
- [ ] Persist BookingRequest to PostgreSQL
- [ ] Slot reservation with optimistic locking
- [ ] Patient identity management

### Cycle 5 -- Hardening
- [ ] PHI-safe audit logging
- [ ] Idempotency keys on booking creation
- [ ] Rate limiting on tool endpoints
- [ ] E2E integration tests
- [ ] Observability (metrics, traces)

---

## How This Fits the Broader Medical Booking Workflow

```
Patient / Conversation
        |
        |  WhatsApp / Chat
        v
AI Booking Agent (LLM)
        |
        |  calls mcp-agenda-tool
        v
mcp-agenda-tool (this repo)    <- you are here
  * list_specialists
  * search_appointment_slots
  * create_booking_request
        |
        |  BookingRequest (PENDING_CONFIRMATION)
        v
Operator Dashboard (Frontend)
  * Review request
  * Assign/confirm slot
  * Contact patient if needed
        |
        v
Real Backend API / Clinic System
  * Final confirmation
  * Calendar event
  * Patient notification
```

**This repo is intentionally a mock adapter.** It gives the AI agent a stable, testable tool surface during development and allows the agent logic to be built and validated before the real clinic backend is integrated.

---

## Specialties Reference

| Value              | Spanish Name               |
|--------------------|----------------------------|
| CARDIOLOGY         | Cardiología                |
| DERMATOLOGY        | Dermatología               |
| ENDOCRINOLOGY      | Endocrinología             |
| GASTROENTEROLOGY   | Gastroenterología          |
| GENERAL_PRACTICE   | Medicina General           |
| GYNECOLOGY         | Ginecología                |
| NEUROLOGY          | Neurología                 |
| ONCOLOGY           | Oncología                  |
| OPHTHALMOLOGY      | Oftalmología               |
| ORTHOPEDICS        | Traumatología / Ortopedia  |
| PEDIATRICS         | Pediatría                  |
| PSYCHIATRY         | Psiquiatría                |
| PULMONOLOGY        | Neumología                 |
| RHEUMATOLOGY       | Reumatología               |
| UROLOGY            | Urología                   |

---

## License

MIT
