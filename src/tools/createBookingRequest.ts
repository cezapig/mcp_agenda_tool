import { BookingRequest, Specialty } from "../domain";
import { AgendaProvider, CreateBookingRequestInput } from "../providers/AgendaProvider";
import { isValidEmail, isValidPhone } from "../utils";
import { Tool, ToolResult } from "./registry";

// ─────────────────────────────────────────────
// Input type
// ─────────────────────────────────────────────

export interface CreateBookingRequestToolInput {
  patientName: string;
  phone?: string;
  email?: string;
  specialty: string;
  reason: string;
  /** Pre-selected slot id — mutually exclusive with preferredWindow */
  slotId?: string;
  /** Preferred window when no specific slot is chosen */
  preferredWindow?: { from: string; to: string };
  notes?: string;
}

// ─────────────────────────────────────────────
// Tool
// ─────────────────────────────────────────────

export function createBookingRequestTool(
  provider: AgendaProvider
): Tool<CreateBookingRequestToolInput, BookingRequest> {
  return {
    name: "create_booking_request",
    description:
      "Creates a new booking request for a medical consultation. Requires patient name, at least one contact method (phone or email), specialty, and reason for visit.",

    execute(input: CreateBookingRequestToolInput): ToolResult<BookingRequest> {
      // ── Validate patientName ──────────────────
      if (!input.patientName || input.patientName.trim() === "") {
        return { success: false, error: "patientName is required." };
      }

      // ── Validate contact ─────────────────────
      const hasPhone = !!input.phone && input.phone.trim() !== "";
      const hasEmail = !!input.email && input.email.trim() !== "";

      if (!hasPhone && !hasEmail) {
        return {
          success: false,
          error: "At least one contact method is required: phone or email.",
        };
      }
      if (hasPhone && !isValidPhone(input.phone!)) {
        return {
          success: false,
          error: `Invalid phone number: "${input.phone}".`,
        };
      }
      if (hasEmail && !isValidEmail(input.email!)) {
        return {
          success: false,
          error: `Invalid email address: "${input.email}".`,
        };
      }

      // ── Validate specialty ───────────────────
      if (!input.specialty || input.specialty.trim() === "") {
        return { success: false, error: "specialty is required." };
      }
      const specialty = input.specialty.toUpperCase() as Specialty;
      if (!Object.values(Specialty).includes(specialty)) {
        return {
          success: false,
          error: `Invalid specialty "${input.specialty}". Valid values: ${Object.values(Specialty).join(", ")}`,
        };
      }

      // ── Validate reason ──────────────────────
      if (!input.reason || input.reason.trim() === "") {
        return { success: false, error: "reason is required." };
      }

      // ── Validate slotId if provided ──────────
      if (input.slotId) {
        const slot = provider.getSlotById(input.slotId);
        if (!slot) {
          return {
            success: false,
            error: `Slot with id "${input.slotId}" not found.`,
          };
        }
      }

      // ── Validate preferredWindow if provided ──
      if (input.preferredWindow) {
        const { from, to } = input.preferredWindow;
        if (!from || !to) {
          return {
            success: false,
            error: "preferredWindow must include both 'from' and 'to' dates.",
          };
        }
        if (from > to) {
          return {
            success: false,
            error: "preferredWindow.from must be before or equal to preferredWindow.to.",
          };
        }
      }

      // ── Create request ───────────────────────
      const bookingInput: CreateBookingRequestInput = {
        patientName: input.patientName.trim(),
        contact: {
          phone: hasPhone ? input.phone!.trim() : undefined,
          email: hasEmail ? input.email!.trim() : undefined,
        },
        specialty,
        reason: input.reason.trim(),
        slotId: input.slotId,
        preferredWindow: input.preferredWindow,
        notes: input.notes?.trim(),
      };

      const request = provider.createBookingRequest(bookingInput);
      return { success: true, data: request };
    },
  };
}
