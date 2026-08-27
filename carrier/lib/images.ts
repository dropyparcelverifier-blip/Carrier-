/**
 * Photography. Every ID below was downloaded and visually inspected before
 * use — nothing here is guessed. Served from images.unsplash.com, which is
 * allow-listed in next.config.ts and handled by next/image.
 *
 * Shots showing a third-party brand's packaging were deliberately rejected so
 * the site never implies a relationship that does not exist.
 */
const base = "https://images.unsplash.com/";
const q = "?auto=format&fit=crop&q=72";

/**
 * Freight imagery is LOCAL now — /public/hero, served from our own domain.
 *
 * These were Unsplash URLs: an external request per image on first paint,
 * a third party in the critical render path, and no guarantee the photo
 * stays up. They're also generated to a consistent house style now rather
 * than eight unrelated stock photos.
 *
 * The beauty-product keys below are still Unsplash. They're used by the
 * quote page and category showcase, which are a separate decision.
 */
export const IMAGES = {
  /* ---- Product categories ---- */
  colourCosmetics: {
    src: `${base}photo-1522335789203-aabd1fc54bc9${q}&w=1200`,
    alt: "Eyeshadow palette, compacts and lip products laid out on a marble surface",
  },
  beautyFlatlay: {
    src: `${base}photo-1596462502278-27bfdc403348${q}&w=1200`,
    alt: "Makeup brushes, lipstick and compacts arranged on a neutral background",
  },
  cosmeticsRender: {
    src: `${base}photo-1631730486572-226d1f595b68${q}&w=1200`,
    alt: "Amber and cream cosmetic bottles and tubes arranged on a soft pink surface",
  },
  skincare: {
    src: `${base}photo-1620916566398-39f1143ab7be${q}&w=1200`,
    alt: "A minimal white body lotion tube resting on folded linen",
  },
  serumDropper: {
    src: `${base}photo-1620916297397-a4a5402a3c6c${q}&w=1200`,
    alt: "A hand holding a small serum bottle and dropper against soft neutral fabric",
  },
  supplements: {
    src: `${base}photo-1584308666744-24d5c474f2ae${q}&w=1200`,
    alt: "Blister packs of capsules and tablets on a blue surface",
  },

  /* ---- Freight & logistics ---- */
  aircraftWing: {
    src: "/hero/hero-2-air-cargo.webp",
    alt: "Freight pallet being loaded into an aircraft at dawn",
  },
  containerShip: {
    src: "/hero/hero-3-container-terminal.webp",
    alt: "Stacked shipping containers at a terminal at first light",
  },
  containerPort: {
    src: "/hero/hero-3-container-terminal.webp",
    alt: "Container terminal with gantry cranes at dawn",
  },
  truck: {
    src: "/hero/hero-5-outbound-dock.webp",
    alt: "Pallets staged at a loading dock beside an open trailer",
  },

  /* ---- Warehouse & fulfilment ---- */
  warehouseRacking: {
    src: "/hero/hero-1-origin-warehouse.webp",
    alt: "Warehouse worker scanning a wrapped pallet of cartons",
  },
  warehouseAisle: {
    src: "/hero/stats-band.webp",
    alt: "Long warehouse aisle lit by overhead work lights",
  },
  distributionFloor: {
    src: "/hero/hero-4-receiving-bay.webp",
    alt: "Wrapped pallets on a receiving bay floor in low afternoon sun",
  },
  binPicking: {
    src: "/hero/about-hero.webp",
    alt: "Two warehouse workers packing cartons at a bench",
  },
  parcelVan: {
    src: `${base}photo-1580674285054-bed31e145f59${q}&w=1400`,
    alt: "Stacked cartons and parcels loaded into the back of a delivery van",
  },
  cartons: {
    src: `${base}photo-1595246140625-573b715d11dc${q}&w=1200`,
    alt: "Two plain kraft shipping cartons photographed from above",
  },
} as const;

export type ImageKey = keyof typeof IMAGES;
