// ─────────────────────────────────────────────
// Enumerations
// ─────────────────────────────────────────────

export enum Specialty {
  CARDIOLOGY = "CARDIOLOGY",
  DERMATOLOGY = "DERMATOLOGY",
  ENDOCRINOLOGY = "ENDOCRINOLOGY",
  GASTROENTEROLOGY = "GASTROENTEROLOGY",
  GENERAL_PRACTICE = "GENERAL_PRACTICE",
  GYNECOLOGY = "GYNECOLOGY",
  NEUROLOGY = "NEUROLOGY",
  ONCOLOGY = "ONCOLOGY",
  OPHTHALMOLOGY = "OPHTHALMOLOGY",
  ORTHOPEDICS = "ORTHOPEDICS",
  PEDIATRICS = "PEDIATRICS",
  PSYCHIATRY = "PSYCHIATRY",
  PULMONOLOGY = "PULMONOLOGY",
  RHEUMATOLOGY = "RHEUMATOLOGY",
  UROLOGY = "UROLOGY",
}

export enum Modality {
  IN_PERSON = "IN_PERSON",
  TELEHEALTH = "TELEHEALTH",
}

export enum SlotStatus {
  AVAILABLE = "AVAILABLE",
  BOOKED = "BOOKED",
  BLOCKED = "BLOCKED",
}

export enum BookingRequestStatus {
  PENDING_CONFIRMATION = "PENDING_CONFIRMATION",
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
  COMPLETED = "COMPLETED",
}

export enum Language {
  SPANISH = "SPANISH",
  ENGLISH = "ENGLISH",
  CATALAN = "CATALAN",
}

// ─────────────────────────────────────────────
// Specialist
// ─────────────────────────────────────────────

export interface Specialist {
  /** Unique identifier */
  id: string;
  /** Full name */
  name: string;
  specialty: Specialty;
  /** Available clinic locations */
  locations: string[];
  /** Consultation modalities offered */
  modalities: Modality[];
  /** Languages spoken */
  languages: Language[];
  /** Short professional bio */
  bio: string;
}

// ─────────────────────────────────────────────
// Appointment Slot
// ─────────────────────────────────────────────

export interface Slot {
  /** Unique identifier */
  id: string;
  specialistId: string;
  /** ISO date string, e.g. "2025-06-01" */
  date: string;
  /** 24-h time string, e.g. "09:00" */
  startTime: string;
  /** 24-h time string, e.g. "09:30" */
  endTime: string;
  modality: Modality;
  /** Clinic location name (null for telehealth) */
  location: string | null;
  status: SlotStatus;
}

// ─────────────────────────────────────────────
// Booking Request
// ─────────────────────────────────────────────

export interface PatientContact {
  phone?: string;
  email?: string;
}

export interface PreferredTimeWindow {
  /** ISO date string for start of window */
  from: string;
  /** ISO date string for end of window */
  to: string;
}

export interface BookingRequest {
  /** Unique identifier */
  id: string;
  patientName: string;
  contact: PatientContact;
  specialty: Specialty;
  /** Reason provided by the patient */
  reason: string;
  /** Specific slot selected (mutually exclusive with preferredWindow) */
  slotId?: string;
  /** Preferred time window when no specific slot is selected */
  preferredWindow?: PreferredTimeWindow;
  status: BookingRequestStatus;
  /** ISO timestamp of request creation */
  createdAt: string;
  /** Free-text notes from the operator */
  notes?: string;
}
