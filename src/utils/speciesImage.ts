const SPECIES_IMAGES: Record<string, ReturnType<typeof require>> = {
  cow: require("../../assets/species-icons/species-cow.png"),
  cattle: require("../../assets/species-icons/species-cow.png"),
  buffalo: require("../../assets/species-icons/species-cow.png"),
  horse: require("../../assets/species-icons/species-horse.png"),
  goat: require("../../assets/species-icons/species-goat.png"),
  dog: require("../../assets/species-icons/species-dog.png"),
  camel: require("../../assets/species-icons/species-camel.png"),
  sheep: require("../../assets/species-icons/species-sheep.png"),
  donkey: require("../../assets/species-icons/species-donkey.png"),
};

export function getSpeciesImageSource(species: string): ReturnType<typeof require> {
  const key = (species || "").trim().toLowerCase();
  const exact = SPECIES_IMAGES[key];
  if (exact) return exact;
  for (const [name, src] of Object.entries(SPECIES_IMAGES)) {
    if (key.includes(name)) return src;
  }
  return SPECIES_IMAGES.dog;
}
