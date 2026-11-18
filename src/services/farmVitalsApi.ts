import { File } from "expo-file-system";

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
  source?: string;
  fields?: FarmTemplateField[];
  promptKey?: string;
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

export function formTypeTitle(type: string): string {
  if (type === "medical-history") return "Medical History";
  if (type === "production-history") return "Production History";
  return type
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function templateKindLabel(type: string): string {
  return formTypeTitle(type).toLowerCase();
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
    if (typeof item.source === "string" && item.source.trim())
      field.source = item.source.trim();
    if (
      (item.type === "upload" || item.type === "image") &&
      typeof item.promptKey === "string" &&
      item.promptKey.trim()
    )
      field.promptKey = item.promptKey.trim();
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

function firstPhotoPrompt(fields: FarmTemplateField[]): string {
  for (const field of fields) {
    if (
      (field.type === "upload" || field.type === "image") &&
      field.promptKey
    )
      return field.promptKey;
    const nested = field.fields ? firstPhotoPrompt(field.fields) : "";
    if (nested) return nested;
  }
  return "";
}

export async function animalPhotoPromptKey(): Promise<string> {
  try {
    const template = await getActiveTemplate("animal");
    return firstPhotoPrompt(
      template.form.steps.flatMap((step) => step.fields),
    );
  } catch {
    return "";
  }
}

export async function uploadFarmImage(
  uri: string,
  fileName: string,
  farmId: string,
  species: string,
  promptKey = "",
): Promise<string> {
  const response = await fetch(`${FARM_VITALS_API_URL}/farm-vitals/uploads`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName,
      farmId,
      species,
      ...(promptKey ? { promptKey } : {}),
    }),
  });
  const payload = await readJson(response);
  const data = isObject(payload) && isObject(payload.data) ? payload.data : null;
  const uploadUrl = text(data?.uploadUrl);
  const fileUrl = text(data?.fileUrl);
  const contentType = text(data?.contentType);
  if (!uploadUrl || !fileUrl || !contentType)
    throw new Error("The image upload link was incomplete.");
  const file = new File(uri);
  const info = file.info();
  if (!info.exists) throw new Error("The selected image could not be read.");
  const uploaded = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: await file.bytes(),
  });
  if (!uploaded.ok) throw new Error("The image could not be uploaded.");
  return fileUrl;
}

function aiFarmImageUrl(fileUrl: string): string {
  let url: URL;
  try {
    url = new URL(fileUrl);
  } catch {
    return "";
  }
  const path = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const slash = path.lastIndexOf("/");
  const directory = slash >= 0 ? path.slice(0, slash) : "";
  const name = slash >= 0 ? path.slice(slash + 1) : path;
  const match = /\.([a-z0-9]+)$/i.exec(name);
  const extension = match?.[1]?.toLowerCase() ?? "";
  const base = extension ? name.slice(0, -(extension.length + 1)) : name;
  if (!extension || /-ai$/i.test(base)) return "";
  const output =
    extension === "jpg" || extension === "jpeg"
      ? "jpeg"
      : extension === "png" || extension === "webp"
        ? extension
        : "";
  if (!output) return "";
  const nextPath = [directory, `${base}-ai.${output}`].filter(Boolean).join("/");
  const encoded = nextPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${url.origin}/${encoded}${url.search}`;
}

export function farmPhotoPairs(
  fileUrls: string[],
): { original: string; enhanced: string }[] {
  return fileUrls.flatMap((fileUrl) => {
    const enhanced = aiFarmImageUrl(fileUrl);
    return enhanced ? [{ original: fileUrl, enhanced }] : [];
  });
}

export async function prepareFarmPost(draft: {
  fileUrls: string[];
  tagline: string;
  note: string;
  farmName: string;
  animalName: string;
  species: string;
  dateLabel: string;
  promptKey?: string;
  rewrite?: boolean;
  description?: string;
}): Promise<{ posterUrl: string; description: string; tagline: string }> {
  const response = await fetch(`${FARM_VITALS_API_URL}/farm-vitals/posts`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...draft,
      promptKey: draft.promptKey || "facebook_post",
    }),
  });
  const payload = await readJson(response);
  const data = isObject(payload) && isObject(payload.data) ? payload.data : null;
  const posterUrl = text(data?.posterUrl);
  const description = text(data?.description);
  const tagline = text(data?.tagline) || draft.tagline;
  if (!posterUrl.startsWith("http") || !description) {
    throw new Error("The post could not be prepared.");
  }
  return { posterUrl, description, tagline };
}

export type SocialPostStatus = "draft" | "ready" | "shared" | "scheduled";

export type SocialPost = {
  postId: string;
  farmId: string;
  entryId: string;
  farmName: string;
  animalName: string;
  species: string;
  dateLabel: string;
  tagline: string;
  printedTagline: string;
  note: string;
  description: string;
  posterUrl: string;
  fileUrls: string[];
  status: SocialPostStatus;
  scheduledFor: string;
  sharedAt: string;
  createdAt: string;
  updatedAt: string;
};

function socialStatus(value: unknown): SocialPostStatus {
  return value === "ready" || value === "shared" || value === "scheduled" || value === "draft"
    ? value
    : "draft";
}

function socialPost(value: unknown): SocialPost | null {
  if (!isObject(value) || !text(value.postId) || !text(value.posterUrl).startsWith("http")) return null;
  return {
    postId: text(value.postId),
    farmId: text(value.farmId),
    entryId: text(value.entryId),
    farmName: text(value.farmName),
    animalName: text(value.animalName),
    species: text(value.species),
    dateLabel: text(value.dateLabel),
    tagline: text(value.tagline),
    printedTagline: text(value.printedTagline),
    note: text(value.note),
    description: text(value.description),
    posterUrl: text(value.posterUrl),
    fileUrls: Array.isArray(value.fileUrls)
      ? value.fileUrls.filter((url): url is string => typeof url === "string")
      : [],
    status: socialStatus(value.status),
    scheduledFor: text(value.scheduledFor),
    sharedAt: text(value.sharedAt),
    createdAt: text(value.createdAt),
    updatedAt: text(value.updatedAt),
  };
}

export async function listSocialPosts(
  farmId: string,
  entryId = "",
  status = "",
): Promise<SocialPost[]> {
  const params = new URLSearchParams();
  if (farmId) params.set("farmId", farmId);
  if (entryId) params.set("entryId", entryId);
  if (status) params.set("status", status);
  const query = params.toString();
  const response = await fetch(
    `${FARM_VITALS_API_URL}/farm-vitals/social-posts${query ? `?${query}` : ""}`,
    { headers: { Accept: "application/json" } },
  );
  const payload = await readJson(response);
  const data = isObject(payload) && isObject(payload.data) ? payload.data : null;
  const posts = Array.isArray(data?.posts) ? data.posts : [];
  return posts.flatMap((item) => {
    const post = socialPost(item);
    return post ? [post] : [];
  });
}

export async function saveSocialPost(input: {
  postId?: string;
  farmId: string;
  entryId: string;
  farmName: string;
  animalName: string;
  species: string;
  dateLabel: string;
  tagline: string;
  printedTagline: string;
  note: string;
  description: string;
  posterUrl: string;
  fileUrls: string[];
  status: SocialPostStatus;
  scheduledFor?: string;
}): Promise<SocialPost> {
  const response = await fetch(
    `${FARM_VITALS_API_URL}/farm-vitals/social-posts${input.postId ? `/${input.postId}` : ""}`,
    {
      method: input.postId ? "PUT" : "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
  const payload = await readJson(response);
  const post = socialPost(isObject(payload) ? payload.data : null);
  if (!post) throw new Error("The post could not be saved.");
  return post;
}

export async function deleteSocialPost(postId: string): Promise<void> {
  const response = await fetch(`${FARM_VITALS_API_URL}/farm-vitals/social-posts/${postId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });
  await readJson(response);
}

export async function readableFarmImage(fileUrl: string): Promise<string> {
  const response = await fetch(`${FARM_VITALS_API_URL}/farm-vitals/uploads/download`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileUrl }),
  });
  const payload = await readJson(response);
  const data = isObject(payload) && isObject(payload.data) ? payload.data : null;
  const downloadUrl = text(data?.downloadUrl);
  if (!downloadUrl.startsWith("http"))
    throw new Error("The photo could not be opened.");
  return downloadUrl;
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

const phoneRule = { pattern: "^\\+92-\\d{3}-\\d{3}-\\d{4}$" };

function utilLeaf(
  key: string,
  label: string,
  type: string,
  rules: FarmFieldRules = {},
): FarmTemplateField {
  return { id: key, key, label, type, helpText: "", rules };
}

function defaultUtilFields(key: string): FarmTemplateField[] {
  if (key === "doctor")
    return [
      utilLeaf("full_name", "Full Name", "text"),
      utilLeaf("phone", "Phone", "text", phoneRule),
    ];
  if (key === "contact")
    return [
      utilLeaf("full_name", "Full Name", "text"),
      utilLeaf("phone", "Phone", "text", phoneRule),
      utilLeaf("nic", "NIC", "text", { pattern: "^\\d{5}-\\d{7}-\\d{1}$" }),
    ];
  if (key === "location")
    return [
      utilLeaf("city", "City", "text"),
      utilLeaf("town", "Town", "text"),
      utilLeaf("district", "District", "text"),
      {
        id: "gps",
        key: "gps",
        label: "GPS",
        type: "group",
        helpText: "Optional.",
        rules: {},
        fields: [
          utilLeaf("latitude", "Latitude", "number", { min: -90, max: 90 }),
          utilLeaf("longitude", "Longitude", "number", { min: -180, max: 180 }),
        ],
      },
    ];
  if (key === "medical-history")
    return [
      utilLeaf("visit_date", "Visit Date", "date"),
      utilLeaf("diagnosis", "Diagnosis", "text"),
      utilLeaf("treatment", "Treatment", "text"),
      utilLeaf("notes", "Notes", "textarea"),
    ];
  if (key === "production-history")
    return [
      utilLeaf("record_date", "Record Date", "date"),
      utilLeaf("product", "Product", "text"),
      utilLeaf("quantity", "Quantity", "number"),
      utilLeaf("notes", "Notes", "textarea"),
    ];
  return [utilLeaf("name", "Name", "text")];
}

function cloneFields(
  fields: FarmTemplateField[],
  prefix: string,
): FarmTemplateField[] {
  return fields.map((field) => ({
    ...field,
    id: `${prefix}.${field.key}`,
    rules: { ...field.rules },
    ...(field.fields
      ? { fields: cloneFields(field.fields, `${prefix}.${field.key}`) }
      : {}),
  }));
}

async function readSourceFields(type: string): Promise<FarmTemplateField[] | null> {
  const response = await fetch(
    `${FARM_VITALS_API_URL}/farm-vitals/form-templates/${encodeURIComponent(type)}`,
    { headers: { Accept: "application/json" } },
  );
  if (response.status === 404) return null;
  const payload = await readJson(response);
  if (!isObject(payload) || !isObject(payload.data)) return null;
  const stored = isObject(payload.data.data) ? payload.data.data : null;
  const adminConfig =
    stored && isObject(stored.adminConfig) ? stored.adminConfig : null;
  const forms = adminConfig ? adminConfig.forms : null;
  const form = Array.isArray(forms) ? parseForm(forms[0]) : null;
  if (!form) return null;
  const fields = form.steps
    .flatMap((step) => step.fields)
    .filter((field) => field.key !== "active");
  return fields.length ? fields : null;
}

async function expandSources(
  fields: FarmTemplateField[],
  cache: Map<string, FarmTemplateField[]>,
  depth = 0,
): Promise<FarmTemplateField[]> {
  if (depth > 5) return fields;
  const expanded: FarmTemplateField[] = [];
  for (const field of fields) {
    if (field.source) {
      if (!cache.has(field.source)) {
        const loaded = await readSourceFields(field.source).catch(() => null);
        cache.set(field.source, loaded ?? defaultUtilFields(field.source));
      }
      const children = await expandSources(
        cloneFields(cache.get(field.source) ?? [], field.id),
        cache,
        depth + 1,
      );
      expanded.push({ ...field, type: "group", fields: children });
      continue;
    }
    expanded.push(
      field.fields
        ? {
            ...field,
            fields: await expandSources(field.fields, cache, depth + 1),
          }
        : field,
    );
  }
  return expanded;
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

export async function getActiveTemplate(
  type: string,
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
  const sources = new Map<string, FarmTemplateField[]>();
  const steps = [];
  for (const step of form.steps) {
    steps.push({
      ...step,
      fields: await expandSources(hydrateFields(step.fields, presets), sources),
    });
  }
  return {
    type: text(record.type, type),
    updatedAt: text(record.updatedAt),
    name: text(adminConfig.name, form.name),
    form: { ...form, steps },
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
export type FarmReviewUtil = {
  key: string;
  label: string;
  filled: boolean;
  rows: FarmReviewRow[];
  field: FarmTemplateField;
};
export type FarmReviewSection = {
  title: string;
  rows: FarmReviewRow[];
  utils?: FarmReviewUtil[];
};
export type FarmHistoryKind = string;

export type FarmFormType = {
  key: string;
  label: string;
  parent: string | null;
  status: "Active" | "Inactive";
};

const BUILTIN_FORM_TYPES: FarmFormType[] = [
  { key: "farm", label: "Farm", parent: null, status: "Active" },
  { key: "animal", label: "Animal", parent: "farm", status: "Active" },
  { key: "doctor", label: "Doctor", parent: null, status: "Active" },
  {
    key: "medical-history",
    label: "Medical History",
    parent: "animal",
    status: "Active",
  },
  {
    key: "production-history",
    label: "Production History",
    parent: "animal",
    status: "Active",
  },
  { key: "contact", label: "Contact", parent: null, status: "Active" },
  { key: "location", label: "Location", parent: null, status: "Active" },
];

function builtinParent(key: string): string | null {
  return BUILTIN_FORM_TYPES.find((type) => type.key === key)?.parent ?? null;
}

export async function listFormTypes(): Promise<FarmFormType[]> {
  try {
    const response = await fetch(`${FARM_VITALS_API_URL}/farm-vitals/form-types`, {
      headers: { Accept: "application/json" },
    });
    const payload = await readJson(response);
    const formTypes =
      isObject(payload) && isObject(payload.data) ? payload.data.formTypes : null;
    if (!Array.isArray(formTypes)) throw new Error("The form type list was incomplete.");
    const parsed = formTypes.flatMap((item): FarmFormType[] => {
      if (!isObject(item) || typeof item.key !== "string" || !item.key) return [];
      const parent =
        "parent" in item
          ? typeof item.parent === "string" && item.parent
            ? item.parent
            : null
          : builtinParent(item.key);
      return [
        {
          key: item.key,
          label:
            typeof item.label === "string" && item.label.trim()
              ? item.label.trim()
              : formTypeTitle(item.key),
          parent,
          status: item.status === "Inactive" ? "Inactive" : "Active",
        },
      ];
    });
    return parsed.length ? parsed : BUILTIN_FORM_TYPES;
  } catch {
    return BUILTIN_FORM_TYPES;
  }
}

export function childFormTypes(
  types: FarmFormType[],
  parent: string,
  recordKinds: string[] = [],
): FarmFormType[] {
  const active = types.filter(
    (type) => type.status === "Active" && type.parent === parent,
  );
  const known = new Set(active.map((type) => type.key));
  const extras = [...new Set(recordKinds)].filter((kind) => !known.has(kind));
  return [
    ...active,
    ...extras.map((key) => ({
      key,
      label: formTypeTitle(key),
      parent,
      status: "Active" as const,
    })),
  ];
}

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
  photos: string[];
  records: FarmHistoryReview[];
};

export type FarmReview = {
  farmId: string;
  name: string;
  submittedAt: string | null;
  sections: FarmReviewSection[];
  animals: FarmAnimalReview[];
  records: FarmHistoryReview[];
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

function animalPhotos(values: Record<string, unknown>): string[] {
  const saved = Array.isArray(values.photos)
    ? values.photos.filter(
        (item): item is string =>
          typeof item === "string" && item.startsWith("http"),
      )
    : [];
  const single = values.animalPhoto ?? values.photo ?? values.image;
  if (
    typeof single === "string" &&
    single.startsWith("http") &&
    !saved.includes(single)
  )
    return [single, ...saved];
  return saved;
}

function historyKind(item: Record<string, unknown>): string | null {
  const template = isObject(item.template) ? item.template : {};
  const form = isObject(item.form) ? item.form : {};
  const kind =
    typeof template.type === "string"
      ? template.type
      : typeof form.entity === "string"
        ? form.entity
        : "";
  if (!kind || kind === "farm" || kind === "animal") return null;
  return kind;
}

function reviewRows(
  fields: FarmTemplateField[],
  values: Record<string, unknown>,
): FarmReviewRow[] {
  return fields.flatMap((field) => {
    if (isStatusField(field) || field.source) return [];
    const value = values[field.key];
    if (field.fields?.length) {
      const nested = isObject(value) ? value : {};
      return reviewRows(field.fields, nested);
    }
    return [{ label: field.label || field.key, value: reviewValue(value) }];
  });
}

function reviewUtils(
  fields: FarmTemplateField[],
  values: Record<string, unknown>,
): FarmReviewUtil[] {
  return fields.flatMap((field) => {
    if (!field.source || isStatusField(field)) return [];
    const value = values[field.key];
    const nested = isObject(value) ? value : {};
    const rows = reviewRows(field.fields ?? [], nested).filter(
      (row) => row.value !== "Not provided",
    );
    return [
      {
        key: field.key,
        label: field.label || field.key,
        filled: rows.length > 0,
        rows,
        field,
      },
    ];
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
    utils: reviewUtils(step.fields, values),
  }));
  const histories = entries.flatMap((item): (FarmHistoryReview & {
    animalEntryId: string;
  })[] => {
    if (!isObject(item)) return [];
    const kind = historyKind(item);
    const animalEntryId =
      typeof item.animalEntryId === "string" ? item.animalEntryId : "";
    if (!kind) return [];
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
          text(historyForm?.name, formTypeTitle(kind)),
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
        photos: animalPhotos(animalValues),
        records: linked,
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
    sections: sections.filter(
      (section) => section.rows.length > 0 || section.utils.length > 0,
    ),
    animals,
    records: histories.filter((history) => !history.animalEntryId),
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

export async function updateFarmGroup(
  farmId: string,
  key: string,
  groupValues: Record<string, unknown>,
): Promise<void> {
  const { data, entries } = await readFarmDocument(farmId);
  let index = -1;
  entries.forEach((item, itemIndex) => {
    if (isObject(item) && isObject(item.form) && item.form.entity === "farm")
      index = itemIndex;
  });
  if (index < 0) throw new Error("This farm could not be updated.");
  const current = entries[index];
  if (!isObject(current)) throw new Error("This farm could not be updated.");
  const values = isObject(current.values) ? { ...current.values } : {};
  values[key] = groupValues;
  const nextEntries = entries.slice();
  nextEntries[index] = { ...current, values };
  await saveFarmDocument(farmId, {
    ...data,
    farmVitals: { version: 1, entries: nextEntries },
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
    template: { type: template.type || "animal", updatedAt: template.updatedAt },
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

export async function addAnimalPhotos(
  farmId: string,
  entryId: string,
  urls: string[],
): Promise<void> {
  const nextUrls = urls.filter((url) => url.startsWith("http"));
  if (!nextUrls.length) return;
  const { data, entries } = await readFarmDocument(farmId);
  const index = entries.findIndex(
    (item) =>
      isObject(item) &&
      item.entryId === entryId &&
      isObject(item.form) &&
      item.form.entity === "animal",
  );
  if (index < 0) throw new Error("This animal is no longer on the farm.");
  const current = entries[index];
  if (!isObject(current)) throw new Error("This animal could not be updated.");
  const values = isObject(current.values) ? { ...current.values } : {};
  const existing = Array.isArray(values.photos)
    ? values.photos.filter((item): item is string => typeof item === "string")
    : [];
  values.photos = [
    ...existing,
    ...nextUrls.filter((url) => !existing.includes(url)),
  ];
  const nextEntries = entries.slice();
  nextEntries[index] = { ...current, values };
  await saveFarmDocument(farmId, {
    ...data,
    farmVitals: { version: 1, entries: nextEntries },
  });
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
  if (!kind || kind === "farm" || kind === "animal")
    throw new Error("Choose a record type for this animal.");
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
