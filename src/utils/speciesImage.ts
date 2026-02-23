import type { ThemeVariant } from "../theme/ThemeProvider";

type SpeciesIconMap = Record<string, ReturnType<typeof require>>;

const CLASSIC_SPECIES_IMAGES: SpeciesIconMap = {
  cow: require("../../assets/species-icons/classic/species-cow.png"),
  cattle: require("../../assets/species-icons/classic/species-cattle.png"),
  buffalo: require("../../assets/species-icons/classic/species-buffalo.png"),
  horse: require("../../assets/species-icons/classic/species-horse.png"),
  goat: require("../../assets/species-icons/classic/species-goat.png"),
  dog: require("../../assets/species-icons/classic/species-dog.png"),
  camel: require("../../assets/species-icons/classic/species-camel.png"),
  sheep: require("../../assets/species-icons/classic/species-sheep.png"),
  donkey: require("../../assets/species-icons/classic/species-donkey.png"),
};

const NEON_SPECIES_IMAGES: SpeciesIconMap = {
  cow: require("../../assets/species-icons/neon-menagerie-orbit/species-cow.png"),
  cattle: require("../../assets/species-icons/neon-menagerie-orbit/species-cattle.png"),
  buffalo: require("../../assets/species-icons/neon-menagerie-orbit/species-buffalo.png"),
  horse: require("../../assets/species-icons/neon-menagerie-orbit/species-horse.png"),
  goat: require("../../assets/species-icons/neon-menagerie-orbit/species-goat.png"),
  dog: require("../../assets/species-icons/neon-menagerie-orbit/species-dog.png"),
  camel: require("../../assets/species-icons/neon-menagerie-orbit/species-camel.png"),
  sheep: require("../../assets/species-icons/neon-menagerie-orbit/species-sheep.png"),
  donkey: require("../../assets/species-icons/neon-menagerie-orbit/species-donkey.png"),
};

const ECO_SPECIES_IMAGES: SpeciesIconMap = {
  cow: require("../../assets/species-icons/eco-organic/species-cow.png"),
  cattle: require("../../assets/species-icons/eco-organic/species-cattle.png"),
  buffalo: require("../../assets/species-icons/eco-organic/species-buffalo.png"),
  horse: require("../../assets/species-icons/eco-organic/species-horse.png"),
  goat: require("../../assets/species-icons/eco-organic/species-goat.png"),
  dog: require("../../assets/species-icons/eco-organic/species-dog.png"),
  camel: require("../../assets/species-icons/eco-organic/species-camel.png"),
  sheep: require("../../assets/species-icons/eco-organic/species-sheep.png"),
  donkey: require("../../assets/species-icons/eco-organic/species-donkey.png"),
};

const CLASSIC_SPECIES_HERO_BANNERS: SpeciesIconMap = {
  cow: require("../../assets/species-icons/classic/hero-banner-cow.png"),
  cattle: require("../../assets/species-icons/classic/hero-banner-cattle.png"),
  buffalo: require("../../assets/species-icons/classic/hero-banner-buffalo.png"),
  horse: require("../../assets/species-icons/classic/hero-banner-horse.png"),
  goat: require("../../assets/species-icons/classic/hero-banner-goat.png"),
  dog: require("../../assets/species-icons/classic/hero-banner-dog.png"),
  camel: require("../../assets/species-icons/classic/hero-banner-camel.png"),
  sheep: require("../../assets/species-icons/classic/hero-banner-sheep.png"),
  donkey: require("../../assets/species-icons/classic/hero-banner-donkey.png"),
};

const NEON_SPECIES_HERO_BANNERS: SpeciesIconMap = {
  cow: require("../../assets/species-icons/neon-menagerie-orbit/hero-banner-cow.png"),
  cattle: require("../../assets/species-icons/neon-menagerie-orbit/hero-banner-cattle.png"),
  buffalo: require("../../assets/species-icons/neon-menagerie-orbit/hero-banner-buffalo.png"),
  horse: require("../../assets/species-icons/neon-menagerie-orbit/hero-banner-horse.png"),
  goat: require("../../assets/species-icons/neon-menagerie-orbit/hero-banner-goat.png"),
  dog: require("../../assets/species-icons/neon-menagerie-orbit/hero-banner-dog.png"),
  camel: require("../../assets/species-icons/neon-menagerie-orbit/hero-banner-camel.png"),
  sheep: require("../../assets/species-icons/neon-menagerie-orbit/hero-banner-sheep.png"),
  donkey: require("../../assets/species-icons/neon-menagerie-orbit/hero-banner-donkey.png"),
};

const ECO_SPECIES_HERO_BANNERS: SpeciesIconMap = {
  cow: require("../../assets/species-icons/eco-organic/hero-banner-cow.png"),
  cattle: require("../../assets/species-icons/eco-organic/hero-banner-cattle.png"),
  buffalo: require("../../assets/species-icons/eco-organic/hero-banner-buffalo.png"),
  horse: require("../../assets/species-icons/eco-organic/hero-banner-horse.png"),
  goat: require("../../assets/species-icons/eco-organic/hero-banner-goat.png"),
  dog: require("../../assets/species-icons/eco-organic/hero-banner-dog.png"),
  camel: require("../../assets/species-icons/eco-organic/hero-banner-camel.png"),
  sheep: require("../../assets/species-icons/eco-organic/hero-banner-sheep.png"),
  donkey: require("../../assets/species-icons/eco-organic/hero-banner-donkey.png"),
};

function getThemeSpeciesImages(themeVariant?: ThemeVariant): SpeciesIconMap {
  if (themeVariant === "neonMenagerieOrbit") {
    return NEON_SPECIES_IMAGES;
  }
  if (themeVariant === "ecoOrganic") {
    return ECO_SPECIES_IMAGES;
  }
  return CLASSIC_SPECIES_IMAGES;
}

export function getSpeciesImageSource(
  species: string,
  themeVariant?: ThemeVariant,
): ReturnType<typeof require> {
  const speciesImages = getThemeSpeciesImages(themeVariant);
  const key = (species || "").trim().toLowerCase();
  const exact = speciesImages[key];
  if (exact) return exact;
  for (const [name, src] of Object.entries(speciesImages)) {
    if (key.includes(name)) return src;
  }
  return speciesImages.dog;
}

export function getSpeciesHeroBannerSource(
  species: string,
  themeVariant?: ThemeVariant,
): ReturnType<typeof require> {
  const heroMap =
    themeVariant === "neonMenagerieOrbit"
      ? NEON_SPECIES_HERO_BANNERS
      : themeVariant === "ecoOrganic"
        ? ECO_SPECIES_HERO_BANNERS
        : CLASSIC_SPECIES_HERO_BANNERS;
  const key = (species || "").trim().toLowerCase();
  const exact = heroMap[key];
  if (exact) return exact;
  for (const [name, src] of Object.entries(heroMap)) {
    if (key.includes(name)) return src;
  }
  return heroMap.dog;
}
