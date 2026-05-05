import { Slot } from "../domain";
import { AgendaProvider } from "../providers/AgendaProvider";
import { Tool, ToolResult } from "./registry";

// ─────────────────────────────────────────────
// Input type
// ─────────────────────────────────────────────

export interface GetSpecialistAvailabilityInput {
  specialistId: string;
}

// ─────────────────────────────────────────────
// Tool
// ─────────────────────────────────────────────

export function createGetSpecialistAvailabilityTool(
  provider: AgendaProvider
): Tool<GetSpecialistAvailabilityInput, Slot[]> {
  return {
    name: "get_specialist_availability",
    description:
      "Returns all available appointment slots for a given specialist over the next 14 weekdays.",

    execute(input: GetSpecialistAvailabilityInput): ToolResult<Slot[]> {
      if (!input.specialistId || input.specialistId.trim() === "") {
        return { success: false, error: "specialistId is required." };
      }

      const specialist = provider.getSpecialistById(input.specialistId);
      if (!specialist) {
        return {
          success: false,
          error: `Specialist with id "${input.specialistId}" not found.`,
        };
      }

      const slots = provider.getSpecialistAvailability(input.specialistId);
      return { success: true, data: slots };
    },
  };
}
