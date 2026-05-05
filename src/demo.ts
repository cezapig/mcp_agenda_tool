/**
 * demo.ts — Interactive demonstration of mcp-agenda-tool
 *
 * Run with: npm run demo
 * Shows example calls to every registered tool.
 */

import { registry } from "./index";

function section(title: string): void {
  console.log("\n" + "═".repeat(60));
  console.log(` ${title}`);
  console.log("═".repeat(60));
}

function call(toolName: string, input: unknown): void {
  console.log(`\n▶ ${toolName}`);
  console.log("  Input:", JSON.stringify(input, null, 2));
  const result = registry.call(toolName, input);
  if (result.success) {
    const data = result.data;
    if (Array.isArray(data)) {
      console.log(`  Result: [${data.length} items]`);
      if (data.length > 0) {
        console.log("  First item:", JSON.stringify(data[0], null, 2));
      }
    } else {
      console.log("  Result:", JSON.stringify(data, null, 2));
    }
  } else {
    console.log("  Error:", result.error);
  }
}

// ── Demo ──────────────────────────────────────────────────────────────────────

section("1. list_specialists — all");
call("list_specialists", {});

section("2. list_specialists — CARDIOLOGY");
call("list_specialists", { specialty: "CARDIOLOGY" });

section("3. list_specialists — TELEHEALTH + ENGLISH");
call("list_specialists", { modality: "TELEHEALTH", language: "ENGLISH" });

section("4. get_specialist_availability — spec-001");
call("get_specialist_availability", { specialistId: "spec-001" });

section("5. search_appointment_slots — PEDIATRICS, IN_PERSON");
call("search_appointment_slots", {
  specialty: "PEDIATRICS",
  modality: "IN_PERSON",
});

section("6. search_appointment_slots — Clínica Central, next 7 days");
const today = new Date();
const in7 = new Date(today);
in7.setDate(today.getDate() + 7);
const pad = (n: number): string => String(n).padStart(2, "0");
const fromDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
const toDate = `${in7.getFullYear()}-${pad(in7.getMonth() + 1)}-${pad(in7.getDate())}`;
call("search_appointment_slots", {
  location: "Clínica Central",
  fromDate,
  toDate,
});

section("7. create_booking_request — with slotId");
// First find a valid slot
const slotsResult = registry.call("search_appointment_slots", {
  specialty: "GENERAL_PRACTICE",
});
let exampleSlotId: string | undefined;
if (slotsResult.success && Array.isArray(slotsResult.data) && slotsResult.data.length > 0) {
  exampleSlotId = slotsResult.data[0].id;
}
call("create_booking_request", {
  patientName: "María González",
  email: "maria.gonzalez@email.com",
  phone: "+34 612 345 678",
  specialty: "GENERAL_PRACTICE",
  reason: "Revisión anual y control de tensión arterial",
  slotId: exampleSlotId,
});

section("8. create_booking_request — with preferred window");
call("create_booking_request", {
  patientName: "Juan Pérez",
  phone: "+34 698 765 432",
  specialty: "CARDIOLOGY",
  reason: "Palpitaciones frecuentes y mareos al hacer ejercicio",
  preferredWindow: { from: fromDate, to: toDate },
});

section("9. create_booking_request — validation error (no contact)");
call("create_booking_request", {
  patientName: "Carlos López",
  specialty: "DERMATOLOGY",
  reason: "Revisión de lunar",
});

section("10. create_booking_request — validation error (invalid specialty)");
call("create_booking_request", {
  patientName: "Ana Torres",
  email: "ana@email.com",
  specialty: "ASTROLOGY",
  reason: "Consulta",
});
