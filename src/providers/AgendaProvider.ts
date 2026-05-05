import {
  Specialist,
  Slot,
  BookingRequest,
  Specialty,
  Modality,
  Language,
} from "../domain";

// ─────────────────────────────────────────────
// Filter types
// ─────────────────────────────────────────────

export interface SpecialistFilter {
  specialty?: Specialty;
  location?: string;
  modality?: Modality;
  language?: Language;
}

export interface SlotFilter {
  specialistId?: string;
  specialty?: Specialty;
  location?: string;
  modality?: Modality;
  /** ISO date string, inclusive lower bound */
  fromDate?: string;
  /** ISO date string, inclusive upper bound */
  toDate?: string;
}

// ─────────────────────────────────────────────
// Input types
// ─────────────────────────────────────────────

export interface CreateBookingRequestInput {
  patientName: string;
  contact: { phone?: string; email?: string };
  specialty: Specialty;
  reason: string;
  slotId?: string;
  preferredWindow?: { from: string; to: string };
  notes?: string;
}

// ─────────────────────────────────────────────
// Provider interface
// ─────────────────────────────────────────────

/**
 * AgendaProvider is the primary abstraction for all scheduling operations.
 * The in-memory implementation can be replaced with a real backend adapter
 * without changing the tool layer.
 */
export interface AgendaProvider {
  /** Return all specialists, optionally filtered */
  listSpecialists(filter?: SpecialistFilter): Specialist[];

  /** Return a specific specialist by id */
  getSpecialistById(id: string): Specialist | undefined;

  /** Return all available slots for a specialist within the next 14 weekdays */
  getSpecialistAvailability(specialistId: string): Slot[];

  /** Search slots with flexible filters */
  searchSlots(filter: SlotFilter): Slot[];

  /** Return a specific slot by id */
  getSlotById(id: string): Slot | undefined;

  /** Create a new booking request */
  createBookingRequest(input: CreateBookingRequestInput): BookingRequest;

  /** Return all booking requests */
  listBookingRequests(): BookingRequest[];

  /** Return a specific booking request by id */
  getBookingRequestById(id: string): BookingRequest | undefined;
}
