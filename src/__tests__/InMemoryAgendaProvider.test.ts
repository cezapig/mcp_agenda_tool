import { InMemoryAgendaProvider } from "../providers/InMemoryAgendaProvider";
import { Specialty, Modality, Language, SlotStatus, BookingRequestStatus } from "../domain";

describe("InMemoryAgendaProvider", () => {
  // Use a fixed seed date to make slot generation deterministic
  // Monday 2025-06-02
  const SEED_DATE = new Date("2025-06-02T08:00:00");
  let provider: InMemoryAgendaProvider;

  beforeEach(() => {
    provider = new InMemoryAgendaProvider(SEED_DATE);
  });

  // ── Specialists ──────────────────────────────

  describe("listSpecialists", () => {
    it("returns all 10 seed specialists when no filter is given", () => {
      expect(provider.listSpecialists()).toHaveLength(10);
    });

    it("filters by specialty", () => {
      const specialists = provider.listSpecialists({ specialty: Specialty.CARDIOLOGY });
      expect(specialists).toHaveLength(1);
      expect(specialists[0].specialty).toBe(Specialty.CARDIOLOGY);
    });

    it("filters by modality IN_PERSON", () => {
      const specialists = provider.listSpecialists({ modality: Modality.IN_PERSON });
      // All specialists offer IN_PERSON
      expect(specialists.length).toBeGreaterThan(0);
      specialists.forEach((s) => expect(s.modalities).toContain(Modality.IN_PERSON));
    });

    it("filters by language CATALAN", () => {
      const specialists = provider.listSpecialists({ language: Language.CATALAN });
      expect(specialists.length).toBeGreaterThan(0);
      specialists.forEach((s) => expect(s.languages).toContain(Language.CATALAN));
    });

    it("filters by location (case-insensitive partial match)", () => {
      const specialists = provider.listSpecialists({ location: "norte" });
      expect(specialists.length).toBeGreaterThan(0);
      specialists.forEach((s) =>
        expect(s.locations.some((l) => l.toLowerCase().includes("norte"))).toBe(true)
      );
    });

    it("returns empty array when no match", () => {
      const specialists = provider.listSpecialists({ specialty: Specialty.ONCOLOGY });
      expect(specialists).toHaveLength(0);
    });
  });

  describe("getSpecialistById", () => {
    it("returns the correct specialist", () => {
      const specialist = provider.getSpecialistById("spec-001");
      expect(specialist).toBeDefined();
      expect(specialist?.specialty).toBe(Specialty.CARDIOLOGY);
    });

    it("returns undefined for unknown id", () => {
      expect(provider.getSpecialistById("unknown")).toBeUndefined();
    });
  });

  // ── Slots ────────────────────────────────────

  describe("getSpecialistAvailability", () => {
    it("returns only AVAILABLE slots for the specialist", () => {
      const slots = provider.getSpecialistAvailability("spec-001");
      expect(slots.length).toBeGreaterThan(0);
      slots.forEach((s) => {
        expect(s.specialistId).toBe("spec-001");
        expect(s.status).toBe(SlotStatus.AVAILABLE);
      });
    });

    it("returns empty array for unknown specialist", () => {
      const slots = provider.getSpecialistAvailability("unknown");
      expect(slots).toHaveLength(0);
    });
  });

  describe("searchSlots", () => {
    it("returns slots filtered by specialty", () => {
      const slots = provider.searchSlots({ specialty: Specialty.CARDIOLOGY });
      expect(slots.length).toBeGreaterThan(0);
      // All returned slots belong to a cardiology specialist
      const cardiologists = provider
        .listSpecialists({ specialty: Specialty.CARDIOLOGY })
        .map((s) => s.id);
      slots.forEach((s) => expect(cardiologists).toContain(s.specialistId));
    });

    it("returns slots filtered by modality TELEHEALTH", () => {
      const slots = provider.searchSlots({ modality: Modality.TELEHEALTH });
      expect(slots.length).toBeGreaterThan(0);
      slots.forEach((s) => {
        expect(s.modality).toBe(Modality.TELEHEALTH);
        expect(s.location).toBeNull();
      });
    });

    it("returns slots filtered by date range", () => {
      const slots = provider.searchSlots({
        fromDate: "2025-06-02",
        toDate: "2025-06-06",
      });
      expect(slots.length).toBeGreaterThan(0);
      slots.forEach((s) => {
        expect(s.date >= "2025-06-02").toBe(true);
        expect(s.date <= "2025-06-06").toBe(true);
      });
    });

    it("returns slots sorted by date then startTime", () => {
      const slots = provider.searchSlots({ specialty: Specialty.CARDIOLOGY });
      for (let i = 1; i < slots.length; i++) {
        const prev = slots[i - 1];
        const curr = slots[i];
        if (prev.date === curr.date) {
          expect(prev.startTime <= curr.startTime).toBe(true);
        } else {
          expect(prev.date <= curr.date).toBe(true);
        }
      }
    });

    it("only returns AVAILABLE slots", () => {
      const slots = provider.searchSlots({});
      slots.forEach((s) => expect(s.status).toBe(SlotStatus.AVAILABLE));
    });
  });

  describe("getSlotById", () => {
    it("returns a slot when it exists", () => {
      const allSlots = provider.searchSlots({});
      const slot = provider.getSlotById(allSlots[0].id);
      expect(slot).toBeDefined();
      expect(slot?.id).toBe(allSlots[0].id);
    });

    it("returns undefined for unknown id", () => {
      expect(provider.getSlotById("unknown")).toBeUndefined();
    });
  });

  // ── Booking requests ─────────────────────────

  describe("createBookingRequest", () => {
    it("creates a booking request with PENDING_CONFIRMATION status", () => {
      const request = provider.createBookingRequest({
        patientName: "Test Patient",
        contact: { email: "test@test.com" },
        specialty: Specialty.GENERAL_PRACTICE,
        reason: "Annual checkup",
      });
      expect(request.id).toBeDefined();
      expect(request.status).toBe(BookingRequestStatus.PENDING_CONFIRMATION);
      expect(request.patientName).toBe("Test Patient");
      expect(request.contact.email).toBe("test@test.com");
    });

    it("persists booking requests", () => {
      provider.createBookingRequest({
        patientName: "Patient A",
        contact: { phone: "+1234567890" },
        specialty: Specialty.CARDIOLOGY,
        reason: "Check",
      });
      provider.createBookingRequest({
        patientName: "Patient B",
        contact: { phone: "+0987654321" },
        specialty: Specialty.DERMATOLOGY,
        reason: "Skin check",
      });
      expect(provider.listBookingRequests()).toHaveLength(2);
    });

    it("can be retrieved by id", () => {
      const created = provider.createBookingRequest({
        patientName: "Patient C",
        contact: { email: "c@c.com" },
        specialty: Specialty.NEUROLOGY,
        reason: "Headache",
      });
      const found = provider.getBookingRequestById(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it("accepts a valid slotId", () => {
      const slots = provider.searchSlots({ specialty: Specialty.GENERAL_PRACTICE });
      const slot = slots[0];
      const request = provider.createBookingRequest({
        patientName: "Slot Patient",
        contact: { phone: "+1234567" },
        specialty: Specialty.GENERAL_PRACTICE,
        reason: "Check",
        slotId: slot.id,
      });
      expect(request.slotId).toBe(slot.id);
    });
  });
});
