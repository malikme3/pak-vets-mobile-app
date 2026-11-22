import { File } from "expo-file-system";
import { readCoordinates, type Coordinates } from "../utils/coordinates";

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
  showOnDashboard?: boolean;
  fullWidth?: boolean;
  fields?: FarmTemplateField[];
  promptKey?: string;
};

type CaseSection = "treatment" | "medicine";

export type FarmDashboardField = {
  key: string;
  source?: string;
  groupKey?: string;
  filter?: boolean;
  fullWidth?: boolean;
};

export type FarmTemplateForm = {
  id: string;
  name: string;
  description: string;
  entity: string;
  status?: string;
  dashboardFields?: FarmDashboardField[];
  steps: {
    id: string;
    title: string;
    caseSection?: CaseSection;
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
  if (type === "health-case") return "Case";
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
      fullWidth: item.fullWidth === true,
    };
    if (typeof item.source === "string" && item.source.trim())
      field.source = item.source.trim();
    if (item.showOnDashboard === true || item.showOnDashboard === false)
      field.showOnDashboard = item.showOnDashboard;
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

function parseDashboardFields(value: unknown): FarmDashboardField[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isObject(item) || typeof item.key !== "string" || !item.key.trim())
      return [];
    return [
      {
        key: item.key.trim(),
        ...(typeof item.source === "string" && item.source.trim()
          ? { source: item.source.trim() }
          : {}),
        ...(typeof item.groupKey === "string" && item.groupKey.trim()
          ? { groupKey: item.groupKey.trim() }
          : {}),
        ...(item.filter === true ? { filter: true } : {}),
        ...(typeof item.fullWidth === "boolean"
          ? { fullWidth: item.fullWidth }
          : {}),
      },
    ];
  });
}

function caseSection(value: unknown): CaseSection | undefined {
  return value === "treatment" || value === "medicine" ? value : undefined;
}

function parseForm(value: unknown): FarmTemplateForm | null {
  if (!isObject(value) || !Array.isArray(value.steps)) return null;
  const steps = value.steps.flatMap((step) => {
    if (!isObject(step)) return [];
    return [
      {
        id: text(step.id, "step"),
        title: text(step.title, "Details"),
        caseSection: caseSection(step.caseSection),
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
    dashboardFields: parseDashboardFields(value.dashboardFields),
    steps,
  };
}

function firstPhotoPrompt(fields: FarmTemplateField[]): string {
  for (const field of fields) {
    if ((field.type === "upload" || field.type === "image") && field.promptKey)
      return field.promptKey;
    const nested = field.fields ? firstPhotoPrompt(field.fields) : "";
    if (nested) return nested;
  }
  return "";
}

export async function animalPhotoPromptKey(): Promise<string> {
  try {
    const template = await getActiveTemplate("animal");
    return firstPhotoPrompt(template.form.steps.flatMap((step) => step.fields));
  } catch {
    return "";
  }
}

export async function uploadFarmMedia(
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
  const data =
    isObject(payload) && isObject(payload.data) ? payload.data : null;
  const uploadUrl = text(data?.uploadUrl);
  const fileUrl = text(data?.fileUrl);
  const contentType = text(data?.contentType);
  if (!uploadUrl || !fileUrl || !contentType)
    throw new Error("The upload link was incomplete.");
  const file = new File(uri);
  const info = file.info();
  if (!info.exists) throw new Error("The selected file could not be read.");
  const uploaded = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: await file.bytes(),
  });
  if (!uploaded.ok) throw new Error("The file could not be uploaded.");
  return fileUrl;
}

export function uploadHealthCaseMedia(
  uri: string,
  name: string,
  farmId: string,
  fallbackExtension: string,
): Promise<string> {
  const extension =
    /\.([a-z0-9]+)$/i.exec(name.trim())?.[1]?.toLowerCase() ??
    fallbackExtension;
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return uploadFarmMedia(uri, `${unique}.${extension}`, farmId, "case");
}

export function uploadFarmImage(
  uri: string,
  fileName: string,
  farmId: string,
  species: string,
  promptKey = "",
): Promise<string> {
  return uploadFarmMedia(uri, fileName, farmId, species, promptKey);
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
  const nextPath = [directory, `${base}-ai.${output}`]
    .filter(Boolean)
    .join("/");
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
  const data =
    isObject(payload) && isObject(payload.data) ? payload.data : null;
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
  return value === "ready" ||
    value === "shared" ||
    value === "scheduled" ||
    value === "draft"
    ? value
    : "draft";
}

function socialPost(value: unknown): SocialPost | null {
  if (
    !isObject(value) ||
    !text(value.postId) ||
    !text(value.posterUrl).startsWith("http")
  )
    return null;
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
  const data =
    isObject(payload) && isObject(payload.data) ? payload.data : null;
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
  const response = await fetch(
    `${FARM_VITALS_API_URL}/farm-vitals/social-posts/${postId}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    },
  );
  await readJson(response);
}

export async function readableFarmImage(fileUrl: string): Promise<string> {
  const response = await fetch(
    `${FARM_VITALS_API_URL}/farm-vitals/uploads/download`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fileUrl }),
    },
  );
  const payload = await readJson(response);
  const data =
    isObject(payload) && isObject(payload.data) ? payload.data : null;
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
  if (key === "treatment")
    return [
      utilLeaf("treatment_name", "Treatment Name", "text", { required: true }),
      utilLeaf("treatment_date", "Treatment Date", "date"),
      utilLeaf("procedure", "Treatment Details", "textarea"),
      utilLeaf("response", "Animal Response", "textarea"),
      utilLeaf("follow_up", "Follow-up Date", "date"),
      utilLeaf("notes", "Additional Notes", "textarea"),
    ];
  if (key === "medicine")
    return [
      utilLeaf("medicine_name", "Medicine Name", "text", { required: true }),
      utilLeaf("strength", "Strength / Concentration", "text"),
      utilLeaf("dose", "Dose and Unit", "text"),
      utilLeaf("route", "Administration Route", "text"),
      utilLeaf("frequency", "Frequency", "text"),
      utilLeaf("duration", "Duration", "text"),
      utilLeaf("start_date", "Start Date", "date"),
      utilLeaf("withdrawal_period", "Withdrawal Period", "text"),
      utilLeaf("notes", "Additional Notes", "textarea"),
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

async function readSourceFields(
  type: string,
): Promise<FarmTemplateField[] | null> {
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
          ? preset.map((child) =>
              catalogField(child, `${field.id}.${child.key}`),
            )
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
    isObject(payload) && isObject(payload.data)
      ? payload.data.inputTypes
      : null;
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
    `${FARM_VITALS_API_URL}/farm-vitals/form-templates/${encodeURIComponent(type)}?active=true&refresh=${Date.now()}`,
    { headers: { Accept: "application/json" } },
  );
  if (type === "health-case" && response.status === 404)
    throw new Error("No active Case template is available.");
  const section = caseSection(type);
  if (section && response.status === 404) {
    const missing: unknown = await response
      .clone()
      .json()
      .catch(() => null);
    if (
      isObject(missing) &&
      isObject(missing.error) &&
      missing.error.message === "Form template not found"
    ) {
      const title = formTypeTitle(section);
      return {
        type: section,
        name: title,
        updatedAt: "",
        adminConfig: {},
        form: {
          id: section,
          name: title,
          entity: section,
          description: "",
          steps: [{ id: section, title, fields: defaultUtilFields(section) }],
        },
      };
    }
  }
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
    throw new Error(
      `No active ${templateKindLabel(type)} template is available.`,
    );
  const presets = await getInputPresets().catch(() => new Map());
  const sources = new Map<string, FarmTemplateField[]>();
  const steps = [];
  for (const step of form.steps) {
    steps.push({
      ...step,
      caseSection: type === "health-case" ? undefined : step.caseSection,
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

export function getActiveHealthCaseTemplate(): Promise<ActiveFarmTemplate> {
  return getActiveTemplate("health-case");
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

export type FarmReviewRow = {
  key?: string;
  groupKey?: string;
  filter?: boolean;
  fullWidth?: boolean;
  label: string;
  value: string;
};
export type FarmReviewUtil = {
  key: string;
  label: string;
  filled: boolean;
  rows: FarmReviewRow[];
  field: FarmTemplateField;
};
export type FarmSectionDraft = {
  fields: FarmTemplateField[];
  values: Record<string, unknown>;
  revision: string;
};

export type FarmReviewSection = {
  edit?: FarmSectionDraft;
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
    const response = await fetch(
      `${FARM_VITALS_API_URL}/farm-vitals/form-types`,
      {
        headers: { Accept: "application/json" },
      },
    );
    const payload = await readJson(response);
    const formTypes =
      isObject(payload) && isObject(payload.data)
        ? payload.data.formTypes
        : null;
    if (!Array.isArray(formTypes))
      throw new Error("The form type list was incomplete.");
    const parsed = formTypes.flatMap((item): FarmFormType[] => {
      if (!isObject(item) || typeof item.key !== "string" || !item.key)
        return [];
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

export type HealthCaseFile = {
  url: string;
  name: string;
  kind: "photo" | "video" | "audio" | "file";
};

export type HealthCaseUpdate = {
  id: string;
  at: string;
  given: string;
  medicine: string;
  notes: string;
  media: HealthCaseFile[];
};

export type HealthCase = {
  entryId: string;
  animalEntryId: string;
  animalName: string;
  status: "draft" | "saved";
  openedAt: string;
  caseTemplate?: { updatedAt: string; form: FarmTemplateForm };
  caseValues?: Record<string, unknown>;
  caseSectionValues?: Partial<Record<CaseSection, Record<string, unknown>>>;
  draftStep?: number;
  complaint: string;
  symptoms: string[];
  onset: string;
  duration: string;
  conditionPhotos: HealthCaseFile[];
  evidence: HealthCaseFile[];
  treatmentGiven: string;
  medicine: string;
  notes: string;
  followUp: string;
  media: HealthCaseFile[];
  updates: HealthCaseUpdate[];
};

export function healthCaseValues(
  health: HealthCase,
  section?: CaseSection,
): Record<string, unknown> {
  if (section === "treatment")
    return (
      health.caseSectionValues?.treatment ?? {
        treatment_name: health.treatmentGiven,
      }
    );
  if (section === "medicine")
    return (
      health.caseSectionValues?.medicine ?? {
        medicine_name: health.medicine,
      }
    );
  return {
    complaint: health.complaint,
    symptoms: health.symptoms.join(", "),
    onset: health.onset,
    duration: health.duration,
    treatment: health.treatmentGiven,
    medicine: health.medicine,
    notes: health.notes,
    follow_up: health.followUp,
    ...health.caseValues,
  };
}

export function healthCaseAnswers(health: HealthCase): [string, string][] {
  function rows(
    fields: FarmTemplateField[],
    answers: Record<string, unknown>,
  ): [string, string][] {
    return fields.flatMap((field): [string, string][] => {
      const value = answers[field.key];
      if (field.fields && isObject(value)) return rows(field.fields, value);
      if (typeof value === "boolean")
        return [[field.label, value ? "Yes" : "No"]];
      if (
        typeof value === "number" ||
        (typeof value === "string" && value.trim())
      )
        return [[field.label, String(value)]];
      return [];
    });
  }
  if (health.caseTemplate) {
    return health.caseTemplate.form.steps.flatMap((step) =>
      rows(step.fields, healthCaseValues(health, step.caseSection)),
    );
  }
  const legacyAnswers: [string, string][] = [
    ["Reported Problem", health.complaint],
    ["Observed Symptoms", health.symptoms.join(", ")],
    ["Symptoms First Noticed", health.onset],
    ["Symptom Duration", health.duration],
    ["Treatment", health.treatmentGiven],
    ["Medicine and dosage", health.medicine],
    ["Additional Observations", health.notes],
    ["Follow-up", health.followUp],
  ];
  return legacyAnswers.filter(([, value]) => value.trim());
}

export function updateHealthCaseAnswers(
  health: HealthCase,
  values: Record<string, unknown>,
  section?: CaseSection,
): HealthCase {
  if (section) {
    return {
      ...health,
      caseSectionValues: {
        ...health.caseSectionValues,
        [section]: mergeFarmValues(
          health.caseSectionValues?.[section] ?? {},
          values,
        ),
      },
    };
  }
  function display(key: string): string {
    const value = values[key];
    return typeof value === "number" ? String(value) : text(value);
  }
  return {
    ...health,
    caseValues: mergeFarmValues(health.caseValues ?? {}, values),
    ...("complaint" in values ? { complaint: display("complaint") } : {}),
    ...("symptoms" in values
      ? {
          symptoms: display("symptoms")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }
      : {}),
    ...("onset" in values ? { onset: display("onset") } : {}),
    ...("duration" in values ? { duration: display("duration") } : {}),
    ...("treatment" in values ? { treatmentGiven: display("treatment") } : {}),
    ...("medicine" in values ? { medicine: display("medicine") } : {}),
    ...("notes" in values ? { notes: display("notes") } : {}),
    ...("follow_up" in values ? { followUp: display("follow_up") } : {}),
  };
}

export type FarmHistoryReview = {
  entryId: string;
  kind: FarmHistoryKind;
  name: string;
  submittedAt: string | null;
  sections: FarmReviewSection[];
};

export type FarmAnimalReview = {
  headerBackgroundImageUrl?: string;
  entryId: string;
  name: string;
  species: string;
  submittedAt: string | null;
  sections: FarmReviewSection[];
  photos: string[];
  records: FarmHistoryReview[];
  cases: HealthCase[];
};

export type FarmReview = {
  headerBackgroundImageUrl?: string;
  farmId: string;
  name: string;
  submittedAt: string | null;
  sections: FarmReviewSection[];
  animals: FarmAnimalReview[];
  records: FarmHistoryReview[];
};

export type FarmDashboardEntry = {
  farmId: string;
  name: string;
  submittedAt: string | null;
  rows: FarmReviewRow[];
  location?: Coordinates;
};

function nestedValue(value: unknown, key: string): unknown {
  if (!isObject(value)) return undefined;
  if (key in value) return value[key];
  for (const child of Object.values(value)) {
    const found = nestedValue(child, key);
    if (found !== undefined && found !== "") return found;
  }
  return undefined;
}

function fieldDefinition(
  fields: FarmTemplateField[],
  key: string,
): FarmTemplateField | undefined {
  for (const field of fields) {
    if (field.key === key) return field;
    const nested = field.fields
      ? fieldDefinition(field.fields, key)
      : undefined;
    if (nested) return nested;
  }
  return undefined;
}

function fieldLabel(fields: FarmTemplateField[], key: string): string {
  const field = fieldDefinition(fields, key);
  return field ? field.label || field.key : "";
}

function dashboardRows(
  fields: FarmTemplateField[],
  values: Record<string, unknown>,
  selected: FarmDashboardField[],
): FarmReviewRow[] {
  const chosen: FarmDashboardField[] = selected.length
    ? selected
    : fields
        .filter((field) => field.showOnDashboard === true && !field.source)
        .map((field) => ({ key: field.key }));
  return chosen.flatMap((choice) => {
    const group = choice.groupKey
      ? fields.find((field) => field.key === choice.groupKey)
      : undefined;
    const definition = fieldDefinition(
      choice.groupKey ? (group?.fields ?? []) : fields,
      choice.key,
    );
    const source = choice.groupKey ? values[choice.groupKey] : values;
    const value = choice.groupKey
      ? nestedValue(source, choice.key)
      : values[choice.key];
    const shown = reviewValue(value);
    return [
      {
        key: choice.key,
        ...(choice.groupKey ? { groupKey: choice.groupKey } : {}),
        ...(choice.filter ? { filter: true } : {}),
        fullWidth:
          typeof choice.fullWidth === "boolean"
            ? choice.fullWidth
            : definition?.fullWidth === true,
        label:
          definition?.label || fieldLabel(fields, choice.key) || choice.key,
        value: shown === "Not provided" ? "" : shown,
      },
    ];
  });
}

async function farmEntryValues(
  farmId: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(
    `${FARM_VITALS_API_URL}/farm-vitals/farms/${encodeURIComponent(farmId)}`,
    { headers: { Accept: "application/json" } },
  );
  const payload = await readJson(response);
  if (!isObject(payload) || !isObject(payload.data)) return {};
  const data = isObject(payload.data.data) ? payload.data.data : {};
  const vitals = isObject(data.farmVitals) ? data.farmVitals : {};
  const entries = Array.isArray(vitals.entries) ? vitals.entries : [];
  const entry = [...entries]
    .reverse()
    .find(
      (item) =>
        isObject(item) && isObject(item.form) && item.form.entity === "farm",
    );
  return isObject(entry) && isObject(entry.values) ? entry.values : {};
}

export async function listFarmDashboard(): Promise<FarmDashboardEntry[]> {
  const [template, farms] = await Promise.all([
    getActiveFarmTemplate(),
    listSubmittedFarms(),
  ]);
  const fields = template.form.steps.flatMap((step) => step.fields);
  const selected = template.form.dashboardFields ?? [];
  return Promise.all(
    farms.map(async (farm) => {
      try {
        const values = await farmEntryValues(farm.farmId);
        return {
          farmId: farm.farmId,
          name: namedText(values, farm.name),
          submittedAt: farm.submittedAt,
          rows: dashboardRows(fields, values, selected),
          location: readCoordinates(
            values[
              fields.find((field) => field.source === "location")?.key ??
                "location"
            ] ?? values,
          ),
        };
      } catch {
        return {
          farmId: farm.farmId,
          name: farm.name,
          submittedAt: farm.submittedAt,
          rows: [],
        };
      }
    }),
  );
}

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
        submittedAt:
          typeof item.submittedAt === "string" ? item.submittedAt : null,
      },
    ];
  });
}

function reviewValue(value: unknown): string {
  if (value === null || value === undefined || value === "")
    return "Not provided";
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

function namedText(values: Record<string, unknown>, fallback: string): string {
  const preferred = values.animalName ?? values.farm_name;
  if (typeof preferred === "string" && preferred.trim())
    return preferred.trim();
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
  if (typeof preferred === "string" && preferred.trim())
    return preferred.trim();
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
  separateUtils = false,
): FarmReviewRow[] {
  return fields.flatMap((field) => {
    if (isStatusField(field) || (separateUtils && field.source)) return [];
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
    const rows = reviewRows(field.fields ?? [], nested);
    return [
      {
        key: field.key,
        label: field.label || field.key,
        filled: rows.some((row) => row.value !== "Not provided"),
        rows,
        field,
      },
    ];
  });
}

function caseFiles(value: unknown): HealthCaseFile[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      !isObject(item) ||
      typeof item.url !== "string" ||
      !item.url.startsWith("http")
    )
      return [];
    const kind =
      item.kind === "video" || item.kind === "audio" || item.kind === "file"
        ? item.kind
        : "photo";
    return [{ url: item.url, name: text(item.name, "File"), kind }];
  });
}

function caseUpdates(value: unknown): HealthCaseUpdate[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isObject(item)) return [];
    return [
      {
        id: text(item.id, `${Date.now()}`),
        at: text(item.at),
        given: text(item.given),
        medicine: text(item.medicine),
        notes: text(item.notes),
        media: caseFiles(item.media),
      },
    ];
  });
}

function parseHealthCase(value: unknown): HealthCase | null {
  if (
    !isObject(value) ||
    !isObject(value.template) ||
    value.template.type !== "health-case" ||
    !isObject(value.values)
  )
    return null;
  const values = value.values;
  const form = parseForm(value.form);
  const sections = isObject(values.caseSectionValues)
    ? values.caseSectionValues
    : {};
  const symptoms = Array.isArray(values.symptoms)
    ? values.symptoms.filter(
        (item): item is string =>
          typeof item === "string" && Boolean(item.trim()),
      )
    : [];
  return {
    entryId: text(value.entryId),
    animalEntryId: text(value.animalEntryId),
    animalName: text(values.animalName, "Animal"),
    status: values.status === "saved" ? "saved" : "draft",
    openedAt: text(values.openedAt, text(value.submittedAt)),
    caseTemplate:
      form && isObject(values.caseValues)
        ? { form, updatedAt: text(value.template.updatedAt) }
        : undefined,
    caseValues: isObject(values.caseValues) ? values.caseValues : undefined,
    caseSectionValues: {
      treatment: isObject(sections.treatment) ? sections.treatment : undefined,
      medicine: isObject(sections.medicine) ? sections.medicine : undefined,
    },
    draftStep:
      typeof values.draftStep === "number" && Number.isInteger(values.draftStep)
        ? values.draftStep
        : undefined,
    complaint: text(values.complaint),
    symptoms,
    onset: text(values.onset),
    duration: text(values.duration),
    conditionPhotos: caseFiles(values.conditionPhotos),
    evidence: caseFiles(values.evidence),
    treatmentGiven: text(values.treatmentGiven),
    medicine: text(values.medicine),
    notes: text(values.notes),
    followUp: text(values.followUp),
    media: caseFiles(values.media),
    updates: caseUpdates(values.updates),
  };
}

function healthCaseEntry(health: HealthCase): Record<string, unknown> {
  return {
    entryId: health.entryId,
    animalEntryId: health.animalEntryId,
    submittedAt: health.status === "saved" ? health.openedAt : null,
    template: {
      type: "health-case",
      updatedAt: health.caseTemplate?.updatedAt || health.openedAt,
    },
    form: health.caseTemplate?.form ?? {
      id: "health-case",
      name: "Case",
      description: "",
      entity: "health-case",
      steps: [{ id: "case", title: "Case", fields: [] }],
    },
    values: {
      animalName: health.animalName,
      status: health.status,
      openedAt: health.openedAt,
      caseValues: health.caseValues,
      caseSectionValues: health.caseSectionValues,
      draftStep: health.status === "draft" ? health.draftStep : undefined,
      complaint: health.complaint.trim(),
      symptoms: health.symptoms,
      onset: health.onset.trim(),
      duration: health.duration.trim(),
      conditionPhotos: health.conditionPhotos,
      evidence: health.evidence,
      treatmentGiven: health.treatmentGiven.trim(),
      medicine: health.medicine.trim(),
      notes: health.notes.trim(),
      followUp: health.followUp.trim(),
      media: health.media,
      updates: health.updates,
    },
  };
}

export async function getHealthCase(
  farmId: string,
  entryId: string,
): Promise<HealthCase> {
  const { entries } = await readFarmDocument(farmId);
  const health = entries
    .map(parseHealthCase)
    .find((item) => item?.entryId === entryId);
  if (!health) throw new Error("This case could not be found.");
  return health;
}

export async function saveHealthCase(
  farmId: string,
  health: HealthCase,
  expected?: HealthCase,
): Promise<void> {
  if (!health.animalEntryId) throw new Error("Choose an animal for this case.");
  if (
    health.status === "saved" &&
    !health.caseTemplate &&
    !health.complaint.trim()
  )
    throw new Error("Describe what is wrong with the animal.");
  const { data, entries } = await readFarmDocument(farmId);
  const next = healthCaseEntry(health);
  const index = entries.findIndex(
    (item) => isObject(item) && item.entryId === health.entryId,
  );
  if (
    expected &&
    JSON.stringify(index >= 0 ? parseHealthCase(entries[index]) : null) !==
      JSON.stringify(expected)
  )
    throw new Error(
      "This case changed while you were editing. Cancel and reopen it before saving.",
    );
  const nextEntries = entries.slice();
  if (index >= 0) {
    const current = isObject(entries[index]) ? entries[index] : {};
    nextEntries[index] = {
      ...current,
      ...next,
      ...(expected
        ? {
            form: current.form,
            template: current.template,
            submittedAt: current.submittedAt,
          }
        : {}),
      values: {
        ...(isObject(current.values) ? current.values : {}),
        ...(isObject(next.values) ? next.values : {}),
      },
    };
  } else nextEntries.push(next);
  await saveFarmDocument(farmId, {
    ...data,
    farmVitals: {
      ...(isObject(data.farmVitals) ? data.farmVitals : {}),
      version: 1,
      entries: nextEntries,
    },
  });
}

async function detailFields(
  fields: FarmTemplateField[],
  sources: Map<string, FarmTemplateField[]>,
): Promise<FarmTemplateField[]> {
  return Promise.all(
    fields.map(async (field) => {
      // Saved definitions retain their original child keys; resolve older references only.
      if (field.source && !field.fields?.length)
        return (await expandSources([field], sources))[0] ?? field;
      return field.fields
        ? { ...field, fields: await detailFields(field.fields, sources) }
        : field;
    }),
  );
}

function headerImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? value.trim()
      : undefined;
  } catch {
    return undefined;
  }
}
async function templateHeaderImage(
  type: "farm" | "animal",
): Promise<string | undefined> {
  try {
    const response = await fetch(
      `${FARM_VITALS_API_URL}/farm-vitals/form-templates/${type}?active=true&refresh=${Date.now()}`,
      { headers: { Accept: "application/json" } },
    );
    const payload = await readJson(response);
    if (
      !isObject(payload) ||
      !isObject(payload.data) ||
      !isObject(payload.data.data) ||
      !isObject(payload.data.data.adminConfig)
    )
      return undefined;
    const forms = payload.data.data.adminConfig.forms;
    return Array.isArray(forms) && isObject(forms[0])
      ? headerImageUrl(forms[0].headerBackgroundImageUrl)
      : undefined;
  } catch {
    return undefined;
  }
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
  const entry = [...entries]
    .reverse()
    .find(
      (item) =>
        isObject(item) && isObject(item.form) && item.form.entity === "farm",
    );
  const form = isObject(entry) ? parseForm(entry.form) : null;
  const values = isObject(entry) && isObject(entry.values) ? entry.values : {};
  const [farmHeaderImage, animalHeaderImage] = await Promise.all([
    templateHeaderImage("farm"),
    templateHeaderImage("animal"),
  ]);
  const sources = new Map<string, FarmTemplateField[]>();
  const sections = await Promise.all(
    (form?.steps ?? []).map(async (step) => {
      const fields = await detailFields(step.fields, sources);
      return {
        title: step.title,
        edit: { fields, values, revision: JSON.stringify(entry) },
        rows: reviewRows(fields, values, true),
        utils: reviewUtils(fields, values),
      };
    }),
  );
  const histories = entries.flatMap(
    (
      item,
    ): (FarmHistoryReview & {
      animalEntryId: string;
    })[] => {
      if (!isObject(item)) return [];
      const kind = historyKind(item);
      const animalEntryId =
        typeof item.animalEntryId === "string" ? item.animalEntryId : "";
      if (!kind || kind === "health-case") return [];
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
          name: summary?.value ?? text(historyForm?.name, formTypeTitle(kind)),
          submittedAt:
            typeof item.submittedAt === "string" ? item.submittedAt : null,
          sections,
        },
      ];
    },
  );
  const animals = entries.flatMap((item): FarmAnimalReview[] => {
    if (
      !isObject(item) ||
      !isObject(item.form) ||
      item.form.entity !== "animal"
    )
      return [];
    const animalForm = parseForm(item.form);
    const animalValues = isObject(item.values) ? item.values : {};
    const animalId = text(item.entryId, text(animalForm?.id, "animal"));
    const linked = histories.filter(
      (history) => history.animalEntryId === animalId,
    );
    const cases = entries.flatMap((entry) => {
      const health = parseHealthCase(entry);
      return health && health.animalEntryId === animalId ? [health] : [];
    });
    return [
      {
        entryId: animalId,
        headerBackgroundImageUrl: animalHeaderImage,
        name: namedText(animalValues, text(animalForm?.name, "Animal")),
        species: animalSpecies(animalValues),
        submittedAt:
          typeof item.submittedAt === "string" ? item.submittedAt : null,
        sections: (animalForm?.steps ?? [])
          .map((step) => ({
            title: step.title,
            rows: reviewRows(step.fields, animalValues),
          }))
          .filter((section) => section.rows.length > 0),
        photos: animalPhotos(animalValues),
        records: linked,
        cases,
      },
    ];
  });
  return {
    farmId: text(record.farmId, farmId),
    headerBackgroundImageUrl: farmHeaderImage,
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
    (!isObject(vitals) ||
      vitals.version !== 1 ||
      !Array.isArray(vitals.entries))
  )
    throw new Error("This farm has an unsupported records format.");
  return {
    data,
    entries:
      isObject(vitals) && Array.isArray(vitals.entries) ? vitals.entries : [],
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

function latestFarmEntry(entries: unknown[]): number {
  for (let index = entries.length - 1; index >= 0; index--) {
    const item = entries[index];
    if (isObject(item) && isObject(item.form) && item.form.entity === "farm")
      return index;
  }
  return -1;
}

function mergeFarmValues(
  current: Record<string, unknown>,
  changes: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...current };
  for (const [key, value] of Object.entries(changes)) {
    const previous = current[key];
    merged[key] =
      isObject(previous) && isObject(value)
        ? mergeFarmValues(previous, value)
        : value;
  }
  return merged;
}

export async function updateFarmSection(
  farmId: string,
  revision: string,
  keys: string[],
  changes: Record<string, unknown>,
): Promise<void> {
  const { data, entries } = await readFarmDocument(farmId);
  const index = latestFarmEntry(entries);
  const current = entries[index];
  if (!isObject(current) || JSON.stringify(current) !== revision)
    throw new Error(
      "This farm changed while you were editing. Cancel and reload the farm before saving.",
    );
  const scoped = Object.fromEntries(
    Object.entries(changes).filter(([key]) => keys.includes(key)),
  );
  const nextEntries = entries.slice();
  nextEntries[index] = {
    ...current,
    values: mergeFarmValues(
      isObject(current.values) ? current.values : {},
      scoped,
    ),
  };
  await saveFarmDocument(farmId, {
    ...data,
    farmVitals: {
      ...(isObject(data.farmVitals) ? data.farmVitals : {}),
      version: 1,
      entries: nextEntries,
    },
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
    template: {
      type: template.type || "animal",
      updatedAt: template.updatedAt,
    },
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
  if (!isObject(entry))
    throw new Error("This history is no longer on the animal.");
  const kind = historyKind(entry);
  const form = isObject(entry.form) ? parseForm(entry.form) : null;
  if (!kind || !form)
    throw new Error("This history could not be opened for editing.");
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
