import { Specialist, Specialty, Modality, Language } from "../domain";
import { AgendaProvider, SpecialistFilter } from "../providers/AgendaProvider";
import { Tool, ToolResult } from "./registry";

// ─────────────────────────────────────────────
// Input type
// ─────────────────────────────────────────────

export interface ListSpecialistsInput {
  specialty?: string;
  location?: string;
  modality?: string;
  language?: string;
}

// ─────────────────────────────────────────────
// Tool
// ─────────────────────────────────────────────

export function createListSpecialistsTool(
  provider: AgendaProvider
): Tool<ListSpecialistsInput, Specialist[]> {
  return {
    name: "list_specialists",
    description:
      "Returns a list of medical specialists. Optionally filter by specialty, location, modality, or language.",

    execute(input: ListSpecialistsInput): ToolResult<Specialist[]> {
      const filter: SpecialistFilter = {};

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

      if (input.language) {
        const language = input.language.toUpperCase() as Language;
        if (!Object.values(Language).includes(language)) {
          return {
            success: false,
            error: `Invalid language "${input.language}". Valid values: ${Object.values(Language).join(", ")}`,
          };
        }
        filter.language = language;
      }

      if (input.location) {
        filter.location = input.location;
      }

      const specialists = provider.listSpecialists(filter);
      return { success: true, data: specialists };
    },
  };
}
