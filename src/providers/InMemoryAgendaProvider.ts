import { v4 as uuidv4 } from "uuid";

import {
  Specialist,
  Slot,
  BookingRequest,
  SlotStatus,
  BookingRequestStatus,
  Modality,
} from "../domain";
import { SEED_SPECIALISTS } from "../data";
import {
  getNextDays,
  generateTimeBlocks,
  isWeekday,
} from "../utils";

import {
  AgendaProvider,
  SpecialistFilter,
  SlotFilter,
  CreateBookingRequestInput,
} from "./AgendaProvider";

// ─────────────────────────────────────────────
// Slot generation configuration
// ─────────────────────────────────────────────

const SLOT_CONFIG = {
  morningStart: 9,
  morningEnd: 13,
  afternoonStart: 15,
  afternoonEnd: 19,
  durationMinutes: 30,
  daysAhead: 14,
};

// ─────────────────────────────────────────────
// InMemoryAgendaProvider
// ─────────────────────────────────────────────

/**
 * In-memory implementation of AgendaProvider.
 *
 * On instantiation it:
 * 1. Loads the seed specialist list.
 * 2. Generates available slots for every specialist for the next 14 weekdays.
 *
 * All state is stored in plain Maps so it can be inspected or replaced in tests.
 */
export class InMemoryAgendaProvider implements AgendaProvider {
  private readonly specialists: Map<string, Specialist> = new Map();
  private readonly slots: Map<string, Slot> = new Map();
  private readonly bookingRequests: Map<string, BookingRequest> = new Map();

  constructor(seedDate?: Date) {
    this.seedSpecialists();
    this.generateSlots(seedDate ?? new Date());
  }

  // ── Seeding ──────────────────────────────────

  private seedSpecialists(): void {
    for (const spec of SEED_SPECIALISTS) {
      this.specialists.set(spec.id, spec);
    }
  }

  private generateSlots(from: Date): void {
    const dates = getNextDays(from, SLOT_CONFIG.daysAhead);
    const morningBlocks = generateTimeBlocks(
      SLOT_CONFIG.morningStart,
      SLOT_CONFIG.morningEnd,
      SLOT_CONFIG.durationMinutes
    );
    const afternoonBlocks = generateTimeBlocks(
      SLOT_CONFIG.afternoonStart,
      SLOT_CONFIG.afternoonEnd,
      SLOT_CONFIG.durationMinutes
    );

    for (const specialist of this.specialists.values()) {
      for (const date of dates) {
        if (!isWeekday(date)) continue;

        const blocks = [...morningBlocks, ...afternoonBlocks];
        for (const block of blocks) {
          for (const modality of specialist.modalities) {
            const locations =
              modality === Modality.IN_PERSON
                ? specialist.locations
                : [null];

            for (const location of locations) {
              const slot: Slot = {
                id: uuidv4(),
                specialistId: specialist.id,
                date,
                startTime: block.startTime,
                endTime: block.endTime,
                modality,
                location,
                status: SlotStatus.AVAILABLE,
              };
              this.slots.set(slot.id, slot);
            }
          }
        }
      }
    }
  }

  // ── Specialists ──────────────────────────────

  listSpecialists(filter?: SpecialistFilter): Specialist[] {
    let results = Array.from(this.specialists.values());

    if (filter?.specialty) {
      results = results.filter((s) => s.specialty === filter.specialty);
    }
    if (filter?.location) {
      const loc = filter.location.toLowerCase();
      results = results.filter((s) =>
        s.locations.some((l) => l.toLowerCase().includes(loc))
      );
    }
    if (filter?.modality) {
      results = results.filter((s) =>
        s.modalities.includes(filter.modality as Modality)
      );
    }
    if (filter?.language) {
      results = results.filter((s) =>
        s.languages.includes(filter.language!)
      );
    }

    return results;
  }

  getSpecialistById(id: string): Specialist | undefined {
    return this.specialists.get(id);
  }

  // ── Slots ────────────────────────────────────

  getSpecialistAvailability(specialistId: string): Slot[] {
    return Array.from(this.slots.values()).filter(
      (s) =>
        s.specialistId === specialistId && s.status === SlotStatus.AVAILABLE
    );
  }

  searchSlots(filter: SlotFilter): Slot[] {
    let results = Array.from(this.slots.values()).filter(
      (s) => s.status === SlotStatus.AVAILABLE
    );

    if (filter.specialistId) {
      results = results.filter((s) => s.specialistId === filter.specialistId);
    }

    if (filter.specialty) {
      const specialistIds = Array.from(this.specialists.values())
        .filter((sp) => sp.specialty === filter.specialty)
        .map((sp) => sp.id);
      results = results.filter((s) => specialistIds.includes(s.specialistId));
    }

    if (filter.modality) {
      results = results.filter((s) => s.modality === filter.modality);
    }

    if (filter.location) {
      const loc = filter.location.toLowerCase();
      results = results.filter(
        (s) => s.location !== null && s.location.toLowerCase().includes(loc)
      );
    }

    if (filter.fromDate) {
      results = results.filter((s) => s.date >= filter.fromDate!);
    }

    if (filter.toDate) {
      results = results.filter((s) => s.date <= filter.toDate!);
    }

    return results.sort((a, b) =>
      a.date === b.date
        ? a.startTime.localeCompare(b.startTime)
        : a.date.localeCompare(b.date)
    );
  }

  getSlotById(id: string): Slot | undefined {
    return this.slots.get(id);
  }

  // ── Booking requests ─────────────────────────

  createBookingRequest(input: CreateBookingRequestInput): BookingRequest {
    const request: BookingRequest = {
      id: uuidv4(),
      patientName: input.patientName,
      contact: input.contact,
      specialty: input.specialty,
      reason: input.reason,
      slotId: input.slotId,
      preferredWindow: input.preferredWindow,
      status: BookingRequestStatus.PENDING_CONFIRMATION,
      createdAt: new Date().toISOString(),
      notes: input.notes,
    };
    this.bookingRequests.set(request.id, request);
    return request;
  }

  listBookingRequests(): BookingRequest[] {
    return Array.from(this.bookingRequests.values());
  }

  getBookingRequestById(id: string): BookingRequest | undefined {
    return this.bookingRequests.get(id);
  }
}
