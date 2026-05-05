import { Slot, Specialty, Modality } from "../domain";
import { AgendaProvider, SlotFilter } from "../providers/AgendaProvider";
import { Tool, ToolResult } from "./registry";

// ─────────────────────────────────────────────
// Input type
// ─────────────────────────────────────────────

export interface SearchAppointmentSlotsInput {
  specialty?: string;
  location?: string;
  modality?: string;
  specialistId?: string;
  /** ISO date string YYYY-MM-DD, inclusive */
  fromDate?: string;
  /** ISO date string YYYY-MM-DD, inclusive */
  toDate?: string;
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ─────────────────────────────────────────────
// Tool
// ─────────────────────────────────────────────

export function createSearchAppointmentSlotsTool(
  provider: AgendaProvider
): Tool<SearchAppointmentSlotsInput, Slot[]> {
  return {
    name: "search_appointment_slots",
    description:
      "Searches for available appointment slots. Filter by specialty, location, modality, specialistId, or date range.",

    execute(input: SearchAppointmentSlotsInput): ToolResult<Slot[]> {
      const filter: SlotFilter = {};

      if (input.specialty) {
        const specialty = input.specialty.toUpperCase() as Specialty;
        if (!Object.values(Specialty).includes(specialty)) {
          return {
            success: false,
            error: `Invalid specialty "${input.specialty}". Valid values: ${Object.values(Specialty).join(", ")}`,
          };
        }
        filter.specialty = specialty;
      }

      if (input.modality) {
        const modality = input.modality.toUpperCase() as Modality;
        if (!Object.values(Modality).includes(modality)) {
          return {
            success: false,
            error: `Invalid modality "${input.modality}". Valid values: ${Object.values(Modality).join(", ")}`,
          };
        }
        filter.modality = modality;
      }

      if (input.location) {
        filter.location = input.location;
      }

      if (input.specialistId) {
        const specialist = provider.getSpecialistById(input.specialistId);
        if (!specialist) {
          return {
            success: false,
            error: `Specialist with id "${input.specialistId}" not found.`,
          };
        }
        filter.specialistId = input.specialistId;
      }

      if (input.fromDate) {
        if (!ISO_DATE_REGEX.test(input.fromDate)) {
          return {
            success: false,
            error: `fromDate must be in YYYY-MM-DD format. Got: "${input.fromDate}"`,
          };
        }
        filter.fromDate = input.fromDate;
      }

      if (input.toDate) {
        if (!ISO_DATE_REGEX.test(input.toDate)) {
          return {
            success: false,
            error: `toDate must be in YYYY-MM-DD format. Got: "${input.toDate}"`,
          };
        }
        filter.toDate = input.toDate;
      }

      if (
        filter.fromDate &&
        filter.toDate &&
        filter.fromDate > filter.toDate
      ) {
        return {
          success: false,
          error: "fromDate must be before or equal to toDate.",
        };
      }

      const slots = provider.searchSlots(filter);
      return { success: true, data: slots };
    },
  };
}
