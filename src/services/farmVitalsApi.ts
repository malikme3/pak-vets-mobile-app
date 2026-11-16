const FARM_VITALS_API_URL = (
  process.env.EXPO_PUBLIC_FARM_VITALS_API_URL ||
  "https://dl6axiz667.execute-api.us-east-1.amazonaws.com"
).replace(/\/+$/, "");

export type FarmFieldRules = {
  required?: boolean;
  min?: number | string;
  max?: number | string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  options?: string[];
};

export type FarmTemplateField = {
  id: string;
  key: string;
  label: string;
  type: string;
  helpText: string;
  rules: FarmFieldRules;
  fields?: FarmTemplateField[];
};

export type FarmTemplateForm = {
  id: string;
  name: string;
  description: string;
  entity: string;
  status?: string;
  steps: {
    id: string;
    title: string;
    fields: FarmTemplateField[];
  }[];
};

export type ActiveFarmTemplate = {
  type: string;
  updatedAt: string;
  name: string;
  form: FarmTemplateForm;
  adminConfig: Record<string, unknown>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function templateKindLabel(type: FarmTemplateKind): string {
  if (type === "medical-history") return "medical history";
  if (type === "production-history") return "production history";
  return type;
}

function parseRules(value: unknown): FarmFieldRules {
  if (!isObject(value)) return {};
  const rules: FarmFieldRules = {};
  if (value.required === true) rules.required = true;
  if (typeof value.min === "number" || typeof value.min === "string")
    rules.min = value.min;
  if (typeof value.max === "number" || typeof value.max === "string")
    rules.max = value.max;
  if (typeof value.minLength === "number") rules.minLength = value.minLength;
  if (typeof value.maxLength === "number") rules.maxLength = value.maxLength;
  if (typeof value.pattern === "string") rules.pattern = value.pattern;
  if (Array.isArray(value.options))
    rules.options = value.options.filter(
      (option): option is string => typeof option === "string",
    );
  return rules;
}

function parseFields(value: unknown, depth = 0): FarmTemplateField[] {
  if (!Array.isArray(value) || depth > 5) return [];
  return value.flatMap((item): FarmTemplateField[] => {
    if (!isObject(item) || typeof item.key !== "string") return [];
    const field: FarmTemplateField = {
      id: text(item.id, item.key),
      key: item.key,
      label: text(item.label, item.key),
      type: text(item.type, "text"),
      helpText: text(item.helpText),
      rules: parseRules(item.rules),
    };
    if (Array.isArray(item.fields))
      field.fields = parseFields(item.fields, depth + 1);
    return [field];
  });
}

function parseForm(value: unknown): FarmTemplateForm | null {
  if (!isObject(value) || !Array.isArray(value.steps)) return null;
  const steps = value.steps.flatMap((step) => {
    if (!isObject(step)) return [];
    return [
      {
        id: text(step.id, "step"),
        title: text(step.title, "Details"),
        fields: parseFields(step.fields),
      },
    ];
  });
  if (!steps.length) return null;
  return {
    id: text(value.id, "farm"),
    name: text(value.name, "Farm"),
    description: text(value.description),
    entity: text(value.entity, "farm"),
    status: typeof value.status === "string" ? value.status : undefined,
    steps,
  };
}

async function readJson(response: Response): Promise<unknown> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      isObject(payload) &&
      isObject(payload.error) &&
      typeof payload.error.message === "string"
        ? payload.error.message
        : "The Farm Vitals API could not complete this request.";
    throw new Error(message);
  }
  return payload;
}

type CatalogField = {
  key: string;
  label: string;
  type: string;
  pattern?: string;
  min?: number;
  max?: number;
  fields?: CatalogField[];
};

function parseCatalogFields(value: unknown, depth = 0): CatalogField[] {
  if (!Array.isArray(value) || depth > 5) return [];
  return value.flatMap((item): CatalogField[] => {
    if (!isObject(item) || typeof item.key !== "string") return [];
    const field: CatalogField = {
      key: item.key,
      label: text(item.displayName, item.key),
      type: text(item.type, "text"),
    };
    if (typeof item.pattern === "string") field.pattern = item.pattern;
    if (typeof item.min === "number") field.min = item.min;
    if (typeof item.max === "number") field.max = item.max;
    if (Array.isArray(item.fields))
      field.fields = parseCatalogFields(item.fields, depth + 1);
    return [field];
  });
}

function catalogField(field: CatalogField, id: string): FarmTemplateField {
  const rules: FarmFieldRules = {};
  if (field.pattern) rules.pattern = field.pattern;
  if (field.min !== undefined) rules.min = field.min;
  if (field.max !== undefined) rules.max = field.max;
  return {
    id,
    key: field.key,
    label: field.label,
    type: field.type,
    helpText: "",
    rules,
    ...(field.fields
      ? {
          fields: field.fields.map((child) =>
            catalogField(child, `${id}.${child.key}`),
          ),
        }
      : {}),
  };
}

function hydrateFields(
  fields: FarmTemplateField[],
  presets: Map<string, CatalogField[]>,
): FarmTemplateField[] {
  return fields.map((field) => {
    const preset = presets.get(field.type);
    const children =
      field.fields && field.fields.length > 0
        ? field.fields
        : preset && preset.length > 0
          ? preset.map((child) => catalogField(child, `${field.id}.${child.key}`))
          : undefined;
    if (!children) return field;
    return { ...field, fields: hydrateFields(children, presets) };
  });
}

async function getInputPresets(): Promise<Map<string, CatalogField[]>> {
  const response = await fetch(
    `${FARM_VITALS_API_URL}/farm-vitals/input-types`,
    { headers: { Accept: "application/json" } },
  );
  const payload = await readJson(response);
  const inputTypes =
    isObject(payload) && isObject(payload.data) ? payload.data.inputTypes : null;
  const presets = new Map<string, CatalogField[]>();
  if (!Array.isArray(inputTypes)) return presets;
  for (const item of inputTypes) {
    if (!isObject(item) || typeof item.type !== "string") continue;
    const fields = parseCatalogFields(item.fields);
    if (fields.length) presets.set(item.type, fields);
  }
  return presets;
}

export type FarmTemplateKind =
  | "farm"
  | "animal"
  | "medical-history"
  | "production-history";

export async function getActiveTemplate(
  type: FarmTemplateKind,
): Promise<ActiveFarmTemplate> {
  const response = await fetch(
    `${FARM_VITALS_API_URL}/farm-vitals/form-templates/${type}?active=true`,
    { headers: { Accept: "application/json" } },
  );
  const payload = await readJson(response);
  if (!isObject(payload) || !isObject(payload.data))
    throw new Error("The template response was incomplete.");
  const record = payload.data;
  const stored = isObject(record.data) ? record.data : null;
  const adminConfig =
    stored && isObject(stored.adminConfig) ? stored.adminConfig : null;
  const forms = adminConfig ? adminConfig.forms : null;
  const form = Array.isArray(forms) ? parseForm(forms[0]) : null;
  if (!adminConfig || !form)
    throw new Error(`No active ${templateKindLabel(type)} template is available.`);
  const presets = await getInputPresets().catch(() => new Map());
  return {
    type: text(record.type, type),
    updatedAt: text(record.updatedAt),
    name: text(adminConfig.name, form.name),
    form: {
      ...form,
      steps: form.steps.map((step) => ({
        ...step,
        fields: hydrateFields(step.fields, presets),
      })),
    },
    adminConfig,
  };
}

export function getActiveFarmTemplate(): Promise<ActiveFarmTemplate> {
  return getActiveTemplate("farm");
}

export type SubmittedFarm = {
  farmId: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  submittedAt: string | null;
};

export type FarmReviewRow = { label: string; value: string };
export type FarmReviewSection = { title: string; rows: FarmReviewRow[] };
export type FarmHistoryKind = "medical-history" | "production-history";

export type FarmHistoryReview = {
  entryId: string;
  kind: FarmHistoryKind;
  name: string;
  submittedAt: string | null;
  sections: FarmReviewSection[];
};

export type FarmAnimalReview = {
  entryId: string;
  name: string;
  species: string;
  submittedAt: string | null;
  sections: FarmReviewSection[];
  medicalHistory: FarmHistoryReview[];
  productionHistory: FarmHistoryReview[];
};

export type FarmReview = {
  farmId: string;
  name: string;
  submittedAt: string | null;
  sections: FarmReviewSection[];
  animals: FarmAnimalReview[];
};

export async function listSubmittedFarms(): Promise<SubmittedFarm[]> {
  const response = await fetch(`${FARM_VITALS_API_URL}/farm-vitals/farms`, {
    headers: { Accept: "application/json" },
  });
  const payload = await readJson(response);
  const farms =
    isObject(payload) && isObject(payload.data) ? payload.data.farms : null;
  if (!Array.isArray(farms))
    throw new Error("The farm list response was incomplete.");
  return farms.flatMap((item): SubmittedFarm[] => {
    if (!isObject(item) || typeof item.farmId !== "string") return [];
    return [
      {
        farmId: item.farmId,
        createdAt: text(item.createdAt),
        updatedAt: text(item.updatedAt),
        name: text(item.name, "Farm"),
        submittedAt: typeof item.submittedAt === "string" ? item.submittedAt : null,
      },
    ];
  });
}

function reviewValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return "Not provided";
}

function isStatusField(field: FarmTemplateField): boolean {
  const options = field.rules.options ?? [];
  return (
    field.key === "active" ||
    (options.includes("Active") && options.includes("Inactive"))
  );
}

function namedText(
  values: Record<string, unknown>,
  fallback: string,
): string {
  const preferred = values.animalName ?? values.farm_name;
  if (typeof preferred === "string" && preferred.trim()) return preferred.trim();
  const named = Object.entries(values).find(
    (entry): entry is [string, string] =>
      typeof entry[1] === "string" &&
      entry[1].trim().length > 0 &&
      /name/i.test(entry[0]),
  );
  return named ? named[1].trim() : fallback;
}

function animalSpecies(values: Record<string, unknown>): string {
  const preferred = values.animalType ?? values.species ?? values.type;
  if (typeof preferred === "string" && preferred.trim()) return preferred.trim();
  const named = Object.entries(values).find(
    (entry): entry is [string, string] =>
      typeof entry[1] === "string" &&
      entry[1].trim().length > 0 &&
      /type|species/i.test(entry[0]),
  );
  return named ? named[1].trim() : "";
}

function historyKind(item: Record<string, unknown>): FarmHistoryKind | null {
  const template = isObject(item.template) ? item.template : {};
  const form = isObject(item.form) ? item.form : {};
  const kind = template.type ?? form.entity;
  if (kind === "medical-history" || kind === "production-history") return kind;
  return null;
}

function reviewRows(
  fields: FarmTemplateField[],
  values: Record<string, unknown>,
): FarmReviewRow[] {
  return fields.flatMap((field) => {
    if (isStatusField(field)) return [];
    const value = values[field.key];
    if (field.fields?.length) {
      const nested = isObject(value) ? value : {};
      return reviewRows(field.fields, nested);
    }
    return [{ label: field.label || field.key, value: reviewValue(value) }];
  });
}

export async function getFarmReview(farmId: string): Promise<FarmReview> {
  const response = await fetch(
    `${FARM_VITALS_API_URL}/farm-vitals/farms/${encodeURIComponent(farmId)}`,
    { headers: { Accept: "application/json" } },
  );
  const payload = await readJson(response);
  if (!isObject(payload) || !isObject(payload.data))
    throw new Error("The farm response was incomplete.");
  const record = payload.data;
  const data = isObject(record.data) ? record.data : {};
  const vitals = isObject(data.farmVitals) ? data.farmVitals : {};
  const entries = Array.isArray(vitals.entries) ? vitals.entries : [];
  const entry = [...entries].reverse().find(
    (item) =>
      isObject(item) && isObject(item.form) && item.form.entity === "farm",
  );
  const form = isObject(entry) ? parseForm(entry.form) : null;
  const values =
    isObject(entry) && isObject(entry.values) ? entry.values : {};
  const sections = (form?.steps ?? []).map((step) => ({
    title: step.title,
    rows: reviewRows(step.fields, values),
  }));
  const histories = entries.flatMap((item): (FarmHistoryReview & {
    animalEntryId: string;
  })[] => {
    if (!isObject(item)) return [];
    const kind = historyKind(item);
    const animalEntryId =
      typeof item.animalEntryId === "string" ? item.animalEntryId : "";
    if (!kind || !animalEntryId) return [];
    const historyForm = isObject(item.form) ? parseForm(item.form) : null;
    const historyValues = isObject(item.values) ? item.values : {};
    const sections = (historyForm?.steps ?? [])
      .map((step) => ({
        title: step.title,
        rows: reviewRows(step.fields, historyValues),
      }))
      .filter((section) => section.rows.length > 0);
    const summary = sections
      .flatMap((section) => section.rows)
      .find((row) => row.value !== "Not provided");
    return [
      {
        animalEntryId,
        entryId: text(item.entryId, kind),
        kind,
        name:
          summary?.value ??
          text(
            historyForm?.name,
            kind === "medical-history" ? "Medical History" : "Production History",
          ),
        submittedAt: typeof item.submittedAt === "string" ? item.submittedAt : null,
        sections,
      },
    ];
  });
  const animals = entries.flatMap((item): FarmAnimalReview[] => {
    if (!isObject(item) || !isObject(item.form) || item.form.entity !== "animal")
      return [];
    const animalForm = parseForm(item.form);
    const animalValues = isObject(item.values) ? item.values : {};
    const animalId = text(item.entryId, text(animalForm?.id, "animal"));
    const linked = histories.filter((history) => history.animalEntryId === animalId);
    return [
      {
        entryId: animalId,
        name: namedText(animalValues, text(animalForm?.name, "Animal")),
        species: animalSpecies(animalValues),
        submittedAt: typeof item.submittedAt === "string" ? item.submittedAt : null,
        sections: (animalForm?.steps ?? [])
          .map((step) => ({
            title: step.title,
            rows: reviewRows(step.fields, animalValues),
          }))
          .filter((section) => section.rows.length > 0),
        medicalHistory: linked.filter((history) => history.kind === "medical-history"),
        productionHistory: linked.filter(
          (history) => history.kind === "production-history",
        ),
      },
    ];
  });
  return {
    farmId: text(record.farmId, farmId),
    name: namedText(values, text(form?.name, "Farm")),
    submittedAt:
      isObject(entry) && typeof entry.submittedAt === "string"
        ? entry.submittedAt
        : null,
    sections: sections.filter((section) => section.rows.length > 0),
    animals,
  };
}

async function readFarmDocument(farmId: string): Promise<{
  data: Record<string, unknown>;
  entries: unknown[];
}> {
  const current = await fetch(
    `${FARM_VITALS_API_URL}/farm-vitals/farms/${encodeURIComponent(farmId)}`,
    { headers: { Accept: "application/json" } },
  );
  const payload = await readJson(current);
  if (!isObject(payload) || !isObject(payload.data))
    throw new Error("The farm response was incomplete.");
  const data = isObject(payload.data.data) ? payload.data.data : {};
  const vitals = data.farmVitals;
  if (
    vitals !== undefined &&
    (!isObject(vitals) || vitals.version !== 1 || !Array.isArray(vitals.entries))
  )
    throw new Error("This farm has an unsupported records format.");
  return {
    data,
    entries: isObject(vitals) && Array.isArray(vitals.entries) ? vitals.entries : [],
  };
}

async function saveFarmDocument(
  farmId: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (JSON.stringify(data).length > 240000)
    throw new Error("This farm is too large to save.");
  const saved = await fetch(
    `${FARM_VITALS_API_URL}/farm-vitals/farms/${encodeURIComponent(farmId)}`,
    {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );
  await readJson(saved);
}

async function appendFarmEntry(
  farmId: string,
  entry: Record<string, unknown>,
): Promise<void> {
  const { data, entries } = await readFarmDocument(farmId);
  await saveFarmDocument(farmId, {
    ...data,
    farmVitals: { version: 1, entries: [...entries, entry] },
  });
}

export async function addAnimalRecord(
  farmId: string,
  template: ActiveFarmTemplate,
  values: Record<string, unknown>,
): Promise<void> {
  await appendFarmEntry(farmId, {
    entryId: `${Date.now()}`,
    submittedAt: new Date().toISOString(),
    template: { type: "animal", updatedAt: template.updatedAt },
    form: template.form,
    values,
  });
}

export type AnimalHistoryDraft = {
  entryId: string;
  animalEntryId: string;
  kind: FarmHistoryKind;
  updatedAt: string;
  form: FarmTemplateForm;
  values: Record<string, unknown>;
};

export async function getAnimalHistoryDraft(
  farmId: string,
  entryId: string,
): Promise<AnimalHistoryDraft> {
  const { entries } = await readFarmDocument(farmId);
  const entry = entries.find(
    (item) => isObject(item) && item.entryId === entryId && historyKind(item),
  );
  if (!isObject(entry)) throw new Error("This history is no longer on the animal.");
  const kind = historyKind(entry);
  const form = isObject(entry.form) ? parseForm(entry.form) : null;
  if (!kind || !form) throw new Error("This history could not be opened for editing.");
  return {
    entryId,
    animalEntryId: text(entry.animalEntryId),
    kind,
    updatedAt:
      isObject(entry.template) && typeof entry.template.updatedAt === "string"
        ? entry.template.updatedAt
        : "",
    form,
    values: isObject(entry.values) ? entry.values : {},
  };
}

export async function updateAnimalHistory(
  farmId: string,
  entryId: string,
  values: Record<string, unknown>,
): Promise<void> {
  const { data, entries } = await readFarmDocument(farmId);
  const index = entries.findIndex(
    (item) => isObject(item) && item.entryId === entryId && historyKind(item),
  );
  if (index < 0) throw new Error("This history is no longer on the animal.");
  const current = entries[index];
  if (!isObject(current)) throw new Error("This history could not be updated.");
  const nextEntries = entries.slice();
  nextEntries[index] = { ...current, values };
  await saveFarmDocument(farmId, {
    ...data,
    farmVitals: { version: 1, entries: nextEntries },
  });
}

export async function addAnimalHistory(
  farmId: string,
  animalEntryId: string,
  template: ActiveFarmTemplate,
  values: Record<string, unknown>,
): Promise<void> {
  const kind = template.type;
  if (kind !== "medical-history" && kind !== "production-history")
    throw new Error("Choose medical history or production history.");
  await appendFarmEntry(farmId, {
    entryId: `${Date.now()}`,
    animalEntryId,
    submittedAt: new Date().toISOString(),
    template: { type: kind, updatedAt: template.updatedAt },
    form: template.form,
    values,
  });
}

export async function createFarmRecord(
  template: ActiveFarmTemplate,
  values: Record<string, unknown>,
): Promise<string> {
  const response = await fetch(`${FARM_VITALS_API_URL}/farm-vitals/farms`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      adminConfig: template.adminConfig,
      farmVitals: {
        version: 1,
        entries: [
          {
            entryId: `${Date.now()}`,
            submittedAt: new Date().toISOString(),
            template: { type: "farm", updatedAt: template.updatedAt },
            form: template.form,
            values,
          },
        ],
      },
    }),
  });
  const payload = await readJson(response);
  const farmId =
    isObject(payload) &&
    isObject(payload.data) &&
    typeof payload.data.farmId === "string"
      ? payload.data.farmId
      : "";
  if (!farmId) throw new Error("The farm was saved without an ID.");
  return farmId;
}
