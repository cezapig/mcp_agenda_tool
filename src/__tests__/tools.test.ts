import { InMemoryAgendaProvider } from "../providers/InMemoryAgendaProvider";
import { ToolRegistry } from "../tools/registry";
import {
  createListSpecialistsTool,
  createGetSpecialistAvailabilityTool,
  createSearchAppointmentSlotsTool,
  createBookingRequestTool,
} from "../tools";
import { Specialty, BookingRequestStatus } from "../domain";

// Fixed seed date for determinism
const SEED_DATE = new Date("2025-06-02T08:00:00");

function buildRegistry(): ToolRegistry {
  const provider = new InMemoryAgendaProvider(SEED_DATE);
  const reg = new ToolRegistry();
  reg.register(createListSpecialistsTool(provider));
  reg.register(createGetSpecialistAvailabilityTool(provider));
  reg.register(createSearchAppointmentSlotsTool(provider));
  reg.register(createBookingRequestTool(provider));
  return reg;
}

describe("Tool: list_specialists", () => {
  const registry = buildRegistry();

  it("returns all specialists with empty input", () => {
    const result = registry.call("list_specialists", {});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBe(10);
    }
  });

  it("filters by specialty", () => {
    const result = registry.call("list_specialists", { specialty: "CARDIOLOGY" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBe(1);
      expect(result.data[0].specialty).toBe(Specialty.CARDIOLOGY);
    }
  });

  it("returns error for invalid specialty", () => {
    const result = registry.call("list_specialists", { specialty: "MAGIC" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/Invalid specialty/);
    }
  });

  it("returns error for invalid modality", () => {
    const result = registry.call("list_specialists", { modality: "FLYING" });
    expect(result.success).toBe(false);
  });

  it("returns error for unknown tool name", () => {
    const result = registry.call("unknown_tool", {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/Unknown tool/);
    }
  });
});

describe("Tool: get_specialist_availability", () => {
  const registry = buildRegistry();

  it("returns slots for a valid specialist", () => {
    const result = registry.call("get_specialist_availability", {
      specialistId: "spec-001",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBeGreaterThan(0);
    }
  });

  it("returns error for missing specialistId", () => {
    const result = registry.call("get_specialist_availability", {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/specialistId is required/);
    }
  });

  it("returns error for unknown specialist", () => {
    const result = registry.call("get_specialist_availability", {
      specialistId: "spec-999",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/not found/);
    }
  });
});

describe("Tool: search_appointment_slots", () => {
  const registry = buildRegistry();

  it("returns slots for a valid specialty", () => {
    const result = registry.call("search_appointment_slots", {
      specialty: "PEDIATRICS",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBeGreaterThan(0);
    }
  });

  it("returns error for invalid modality", () => {
    const result = registry.call("search_appointment_slots", {
      modality: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("returns error for invalid date format", () => {
    const result = registry.call("search_appointment_slots", {
      fromDate: "06/02/2025",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/YYYY-MM-DD/);
    }
  });

  it("returns error when fromDate is after toDate", () => {
    const result = registry.call("search_appointment_slots", {
      fromDate: "2025-06-10",
      toDate: "2025-06-05",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/fromDate must be before/);
    }
  });

  it("returns error for unknown specialist id", () => {
    const result = registry.call("search_appointment_slots", {
      specialistId: "spec-999",
    });
    expect(result.success).toBe(false);
  });
});

describe("Tool: create_booking_request", () => {
  it("creates a booking request with email contact", () => {
    const registry = buildRegistry();
    const result = registry.call("create_booking_request", {
      patientName: "María González",
      email: "maria@email.com",
      specialty: "GENERAL_PRACTICE",
      reason: "Annual checkup",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe(BookingRequestStatus.PENDING_CONFIRMATION);
      expect(result.data.patientName).toBe("María González");
    }
  });

  it("creates a booking request with phone contact", () => {
    const registry = buildRegistry();
    const result = registry.call("create_booking_request", {
      patientName: "Carlos López",
      phone: "+34 612 345 678",
      specialty: "CARDIOLOGY",
      reason: "Palpitations",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contact.phone).toBe("+34 612 345 678");
    }
  });

  it("creates a booking request with a valid slotId", () => {
    const provider = new InMemoryAgendaProvider(SEED_DATE);
    const slots = provider.searchSlots({ specialty: Specialty.CARDIOLOGY });
    const slotId = slots[0].id;

    const reg = new ToolRegistry();
    reg.register(createBookingRequestTool(provider));

    const result = reg.call("create_booking_request", {
      patientName: "Slot Patient",
      email: "slot@email.com",
      specialty: "CARDIOLOGY",
      reason: "Check",
      slotId,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slotId).toBe(slotId);
    }
  });

  it("returns error when patientName is missing", () => {
    const registry = buildRegistry();
    const result = registry.call("create_booking_request", {
      email: "test@email.com",
      specialty: "CARDIOLOGY",
      reason: "Check",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/patientName is required/);
    }
  });

  it("returns error when no contact method is provided", () => {
    const registry = buildRegistry();
    const result = registry.call("create_booking_request", {
      patientName: "No Contact",
      specialty: "DERMATOLOGY",
      reason: "Skin issue",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/contact method/);
    }
  });

  it("returns error for invalid email", () => {
    const registry = buildRegistry();
    const result = registry.call("create_booking_request", {
      patientName: "Bad Email",
      email: "not-an-email",
      specialty: "DERMATOLOGY",
      reason: "Skin",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/Invalid email/);
    }
  });

  it("returns error for invalid phone", () => {
    const registry = buildRegistry();
    const result = registry.call("create_booking_request", {
      patientName: "Bad Phone",
      phone: "abc",
      specialty: "DERMATOLOGY",
      reason: "Skin",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/Invalid phone/);
    }
  });

  it("returns error for invalid specialty", () => {
    const registry = buildRegistry();
    const result = registry.call("create_booking_request", {
      patientName: "Test",
      email: "test@email.com",
      specialty: "ASTROLOGY",
      reason: "Stars",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/Invalid specialty/);
    }
  });

  it("returns error for unknown slotId", () => {
    const registry = buildRegistry();
    const result = registry.call("create_booking_request", {
      patientName: "Test",
      email: "test@email.com",
      specialty: "CARDIOLOGY",
      reason: "Check",
      slotId: "non-existent-slot",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/not found/);
    }
  });

  it("creates a booking request with preferred window", () => {
    const registry = buildRegistry();
    const result = registry.call("create_booking_request", {
      patientName: "Window Patient",
      email: "window@email.com",
      specialty: "NEUROLOGY",
      reason: "Headache",
      preferredWindow: { from: "2025-06-10", to: "2025-06-15" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.preferredWindow).toEqual({
        from: "2025-06-10",
        to: "2025-06-15",
      });
    }
  });
});
