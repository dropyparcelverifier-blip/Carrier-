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
    src: `${base}photo-1436491865332-7a61a109cc05${q}&w=1600`,
    alt: "An aircraft wing above clouds lit by low sun",
  },
  containerShip: {
    src: `${base}photo-1578575437130-527eed3abbec${q}&w=1600`,
    alt: "Container ships berthed under gantry cranes at a port terminal",
  },
  containerPort: {
    src: `${base}photo-1494412574643-ff11b0a5c1c3${q}&w=1600`,
    alt: "Aerial view of a container terminal with gantry cranes and stacked containers",
  },
  truck: {
    src: `${base}photo-1519003722824-194d4455a60c${q}&w=1400`,
    alt: "A freight truck on an open highway between mountains",
  },

  /* ---- Warehouse & fulfilment ---- */
  warehouseRacking: {
    src: `${base}photo-1587293852726-70cdb56c2866${q}&w=1200`,
    alt: "Pallets of shrink-wrapped cartons stacked high on warehouse racking",
  },
  warehouseAisle: {
    src: `${base}photo-1553413077-190dd305871c${q}&w=1200`,
    alt: "A long aisle between tall racks of boxed stock in a distribution warehouse",
  },
  distributionFloor: {
    src: `${base}photo-1586528116311-ad8dd3c8310d${q}&w=1400`,
    alt: "A distribution centre floor with sorted parcels in yellow totes and racking behind",
  },
  binPicking: {
    src: `${base}photo-1586528116493-a029325540fa${q}&w=1400`,
    alt: "A warehouse picking aisle lined with yellow parts bins on steel racking",
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
