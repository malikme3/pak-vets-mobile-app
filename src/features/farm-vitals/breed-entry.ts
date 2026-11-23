import type {
  ActiveFarmTemplate,
  FarmTemplateField,
} from "../../services/farmVitalsApi";

const categories = ["Local", "Crossbred", "Exotic", "Other", "Nondescript"];

export type BreedOption = {
  species: string;
  category: "Local" | "Exotic";
  name: string;
  enabled: boolean;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBreedOption(value: unknown): value is BreedOption {
  return (
    isObject(value) &&
    typeof value.species === "string" &&
    (value.category === "Local" || value.category === "Exotic") &&
    typeof value.name === "string" &&
    typeof value.enabled === "boolean"
  );
}

export function readBreedOptions(template: ActiveFarmTemplate): BreedOption[] {
  const catalog = template.adminConfig.breedCatalog;
  if (
    !isObject(catalog) ||
    catalog.version !== 1 ||
    !Array.isArray(catalog.options) ||
    !catalog.options.every(isBreedOption)
  )
    throw new Error(
      "Save the Breed catalog in Template Library before adding breed records.",
    );

  return catalog.options;
}

export function listedBreed(category: unknown): boolean {
  return category === "Local" || category === "Exotic";
}

export function breedSpeciesField(
  key: string,
  options: BreedOption[],
): FarmTemplateField {
  const species = [
    ...new Set(options.map((option) => option.species.trim()).filter(Boolean)),
  ];
  return {
    id: key,
    key,
    label: "Animal species",
    type: species.length ? "select" : "text",
    helpText: "",
    fullWidth: true,
    rules: { required: true, ...(species.length ? { options: species } : {}) },
  };
}

export function breedNameField(
  key: string,
  catalog: BreedOption[],
  species: string,
  category: string,
  previousName?: unknown,
): FarmTemplateField | undefined {
  const listed = listedBreed(category);
  if (!listed && category !== "Crossbred" && category !== "Other") return;
  const options = catalog
    .filter(
      (option) =>
        option.enabled &&
        option.category === category &&
        option.species.trim().toLowerCase() === species.trim().toLowerCase(),
    )
    .map((option) => option.name);
  if (
    typeof previousName === "string" &&
    previousName.trim() &&
    !options.includes(previousName)
  )
    options.push(previousName);
  return {
    id: key,
    key,
    label: "Breed name",
    type: listed ? "select" : "text",
    searchable: listed,
    helpText:
      listed && !options.length
        ? species
          ? "No enabled breeds for this species and category."
          : "Choose an animal species first."
        : "",
    fullWidth: true,
    rules: { required: true, ...(listed ? { options } : {}) },
  };
}

export function inlineBreedFields(fields: FarmTemplateField[]) {
  const category = fields.find((field) => field.optionSource === "breed");
  if (!category) return;
  function freeKey(base: string) {
    let key = base;
    while (fields.some((field) => field.key === key || field.id === key))
      key += "_";
    return key;
  }
  const hasSpecies = fields.some((field) => field.key === "animalType");
  return {
    category,
    speciesKey: hasSpecies ? "animalType" : freeKey("breedSpecies"),
    nameKey: freeKey("breedName"),
    hasSpecies,
  };
}

export function breedEntryTemplate(
  template: ActiveFarmTemplate,
  species: string,
  category: string,
  previous: Record<string, unknown>,
  chooseSpecies = false,
): ActiveFarmTemplate {
  const catalog = readBreedOptions(template);
  const fields: FarmTemplateField[] = [
    {
      id: "breed",
      key: "breed",
      label: "Breed category",
      type: "radio",
      helpText: "",
      fullWidth: true,
      rules: { required: true, options: categories },
    },
  ];

  if (chooseSpecies) fields.unshift(breedSpeciesField("animalType", catalog));
  const detail = breedNameField(
    "breedName",
    catalog,
    species,
    category,
    previous.breed === category ? previous.breedName : undefined,
  );
  if (detail) fields.push(detail);

  return {
    ...template,
    form: {
      ...template.form,
      description: species,
      steps: [{ id: "breed-details", title: "Breed", fields }],
    },
  };
}
