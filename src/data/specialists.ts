import { Specialist, Specialty, Modality, Language } from "../domain";

/**
 * Seed specialists with a realistic Spanish-speaking medical context.
 * Names, clinics, and specialties reflect a typical urban clinic network.
 */
export const SEED_SPECIALISTS: Specialist[] = [
  {
    id: "spec-001",
    name: "Dra. Elena Martínez",
    specialty: Specialty.CARDIOLOGY,
    locations: ["Clínica Central Madrid", "Clínica Norte Madrid"],
    modalities: [Modality.IN_PERSON, Modality.TELEHEALTH],
    languages: [Language.SPANISH, Language.ENGLISH],
    bio: "Cardióloga con 15 años de experiencia en cardiología intervencionista y preventiva.",
  },
  {
    id: "spec-002",
    name: "Dr. Carlos Rodríguez",
    specialty: Specialty.DERMATOLOGY,
    locations: ["Clínica Central Madrid"],
    modalities: [Modality.IN_PERSON, Modality.TELEHEALTH],
    languages: [Language.SPANISH, Language.CATALAN],
    bio: "Dermatólogo especializado en dermatoscopia y tratamiento de melanoma.",
  },
  {
    id: "spec-003",
    name: "Dra. Isabel García",
    specialty: Specialty.PEDIATRICS,
    locations: ["Clínica Sur Madrid", "Clínica Este Madrid"],
    modalities: [Modality.IN_PERSON],
    languages: [Language.SPANISH, Language.ENGLISH],
    bio: "Pediatra con enfoque en desarrollo infantil y enfermedades respiratorias pediátricas.",
  },
  {
    id: "spec-004",
    name: "Dr. Javier López",
    specialty: Specialty.ORTHOPEDICS,
    locations: ["Clínica Central Madrid", "Clínica Norte Madrid"],
    modalities: [Modality.IN_PERSON],
    languages: [Language.SPANISH],
    bio: "Traumatólogo y cirujano ortopédico especializado en rodilla y cadera.",
  },
  {
    id: "spec-005",
    name: "Dra. Ana Fernández",
    specialty: Specialty.GYNECOLOGY,
    locations: ["Clínica Central Madrid", "Clínica Sur Madrid"],
    modalities: [Modality.IN_PERSON, Modality.TELEHEALTH],
    languages: [Language.SPANISH, Language.ENGLISH],
    bio: "Ginecóloga experta en salud reproductiva y medicina materno-fetal.",
  },
  {
    id: "spec-006",
    name: "Dr. Miguel Sánchez",
    specialty: Specialty.NEUROLOGY,
    locations: ["Clínica Norte Madrid"],
    modalities: [Modality.IN_PERSON, Modality.TELEHEALTH],
    languages: [Language.SPANISH, Language.ENGLISH],
    bio: "Neurólogo con especialización en epilepsia y enfermedades neurodegenerativas.",
  },
  {
    id: "spec-007",
    name: "Dra. Lucía Torres",
    specialty: Specialty.PSYCHIATRY,
    locations: ["Clínica Central Madrid", "Clínica Este Madrid"],
    modalities: [Modality.IN_PERSON, Modality.TELEHEALTH],
    languages: [Language.SPANISH, Language.CATALAN, Language.ENGLISH],
    bio: "Psiquiatra con formación en terapia cognitivo-conductual y trastornos del estado de ánimo.",
  },
  {
    id: "spec-008",
    name: "Dr. Roberto Jiménez",
    specialty: Specialty.GASTROENTEROLOGY,
    locations: ["Clínica Sur Madrid"],
    modalities: [Modality.IN_PERSON],
    languages: [Language.SPANISH],
    bio: "Gastroenterólogo experto en endoscopia digestiva y enfermedades inflamatorias intestinales.",
  },
  {
    id: "spec-009",
    name: "Dra. Carmen Ruiz",
    specialty: Specialty.ENDOCRINOLOGY,
    locations: ["Clínica Central Madrid", "Clínica Norte Madrid"],
    modalities: [Modality.IN_PERSON, Modality.TELEHEALTH],
    languages: [Language.SPANISH, Language.ENGLISH],
    bio: "Endocrinóloga especializada en diabetes, tiroides y trastornos metabólicos.",
  },
  {
    id: "spec-010",
    name: "Dr. Pablo Moreno",
    specialty: Specialty.GENERAL_PRACTICE,
    locations: [
      "Clínica Central Madrid",
      "Clínica Norte Madrid",
      "Clínica Sur Madrid",
      "Clínica Este Madrid",
    ],
    modalities: [Modality.IN_PERSON, Modality.TELEHEALTH],
    languages: [Language.SPANISH, Language.ENGLISH],
    bio: "Médico de familia con amplia experiencia en atención primaria y medicina preventiva.",
  },
];

/** All unique clinic locations derived from the seed data */
export const CLINIC_LOCATIONS = Array.from(
  new Set(SEED_SPECIALISTS.flatMap((s) => s.locations))
).sort();
