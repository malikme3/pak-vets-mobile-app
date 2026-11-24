import * as Location from "expo-location";
import type {
  ActiveFarmTemplate,
  FarmTemplateField,
} from "../../services/farmVitalsApi";

function matches(field: FarmTemplateField, names: string[]) {
  return [field.key, field.label].some((value) =>
    names.includes(value.toLowerCase().replace(/[^a-z]/g, "")),
  );
}

function coordinate(field: FarmTemplateField) {
  if (matches(field, ["latitude", "lat"])) return "latitude";
  if (matches(field, ["longitude", "lon", "lng", "long"])) return "longitude";
}

function hasCoordinates(fields: FarmTemplateField[]): boolean {
  return fields.some(
    (field) => coordinate(field) || hasCoordinates(field.fields ?? []),
  );
}

async function currentCoordinates(): Promise<
  Location.LocationObjectCoords | undefined
> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return;
    const position = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 6000);
      }),
    ]);
    return position?.coords;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

export async function entryDefaults(
  template: ActiveFarmTemplate,
  animalTag?: string,
): Promise<Record<string, unknown>> {
  const fields = template.form.steps.flatMap((step) => step.fields);
  const coords = hasCoordinates(fields)
    ? await currentCoordinates()
    : undefined;

  function defaults(fields: FarmTemplateField[]): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.fields?.length) {
        const nested = defaults(field.fields);
        if (Object.keys(nested).length) values[field.key] = nested;
        continue;
      }
      const axis = coordinate(field);
      if (axis && coords && Number.isFinite(coords[axis])) {
        values[field.key] = coords[axis];
      } else if (
        animalTag &&
        matches(field, [
          "animalid",
          "animalidtag",
          "animaltag",
          "animaltagid",
          "tagid",
          "tag",
        ])
      ) {
        values[field.key] = animalTag;
      }
    }
    return values;
  }

  return defaults(fields);
}
