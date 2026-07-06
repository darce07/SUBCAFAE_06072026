import type { Entidad, EntityDocumentType } from "../types";

export const entityDocumentRules: Record<EntityDocumentType, {
  maxLength: number;
  inputMode: "numeric" | "text";
  pattern: RegExp;
  hint: string;
  placeholder: string;
}> = {
  DNI: {
    maxLength: 8,
    inputMode: "numeric",
    pattern: /^[0-9]{8}$/,
    hint: "El DNI debe contener exactamente 8 dígitos.",
    placeholder: "8 dígitos",
  },
  RUC: {
    maxLength: 11,
    inputMode: "numeric",
    pattern: /^[0-9]{11}$/,
    hint: "El RUC debe contener exactamente 11 dígitos.",
    placeholder: "11 dígitos",
  },
  CE: {
    maxLength: 12,
    inputMode: "text",
    pattern: /^[A-Z0-9]{9,12}$/,
    hint: "El carné de extranjería debe contener entre 9 y 12 caracteres alfanuméricos.",
    placeholder: "9 a 12 caracteres",
  },
  PASAPORTE: {
    maxLength: 12,
    inputMode: "text",
    pattern: /^[A-Z0-9]{6,12}$/,
    hint: "El pasaporte debe contener entre 6 y 12 caracteres alfanuméricos.",
    placeholder: "6 a 12 caracteres",
  },
  OTRO: {
    maxLength: 30,
    inputMode: "text",
    pattern: /^[A-Z0-9]{3,30}$/,
    hint: "El documento debe contener entre 3 y 30 caracteres válidos.",
    placeholder: "Número de identificación",
  },
};

export function normalizeEntityDocumentNumber(type: EntityDocumentType | "", value: string) {
  const upper = value.toUpperCase();
  if (type === "DNI" || type === "RUC") return upper.replace(/\D/g, "").slice(0, entityDocumentRules[type].maxLength);
  if (!type) return upper.replace(/[^A-Z0-9]/g, "").slice(0, 30);
  return upper.replace(/[^A-Z0-9]/g, "").slice(0, entityDocumentRules[type].maxLength);
}

export function validateEntityDocument(type: EntityDocumentType | "", value: string, required: boolean) {
  const normalized = normalizeEntityDocumentNumber(type, value);
  if (!type && !normalized && !required) return null;
  if (!type && required) return "Selecciona el tipo de documento de la entidad.";
  if (!type && normalized) return "Selecciona el tipo de documento.";
  if (type && !normalized) return "Ingresa el número de documento.";
  if (!type) return null;
  const rule = entityDocumentRules[type];
  return rule.pattern.test(normalized) ? null : rule.hint;
}

export function findMatchingEntity(
  entities: Entidad[],
  tipoEntidadId: string,
  nombre: string,
  tipoDocumento: EntityDocumentType | "",
  numeroDocumento: string,
) {
  const normalizedName = nombre.trim().toLocaleLowerCase("es");
  const normalizedNumber = normalizeEntityDocumentNumber(tipoDocumento, numeroDocumento);
  return entities.find((entity) => {
    if (entity.tipo_entidad_id !== tipoEntidadId) return false;
    if (tipoDocumento && normalizedNumber) {
      return entity.tipo_documento === tipoDocumento
        && normalizeEntityDocumentNumber(tipoDocumento, entity.numero_documento ?? "") === normalizedNumber;
    }
    return normalizedName.length >= 3
      && entity.nombre.trim().toLocaleLowerCase("es") === normalizedName;
  }) ?? null;
}
