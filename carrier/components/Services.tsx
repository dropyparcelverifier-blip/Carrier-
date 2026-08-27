import Image from "next/image";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/primitives";

/**
 * What we actually do.
 *
 * The site had no section answering this. A B2B buyer arrives asking one
 * question — "do they handle my kind of movement?" — and every other
 * section (lanes, carriers, customs detail, stats) assumes the answer is
 * already yes.
 *
 * Ordered by how a consignment actually moves, not by what sounds most
 * impressive: collect, consolidate, fly, clear, hold, hand off.
 */

const SERVICES: { img: string; alt: string; title: string; body: string; detail: string }[] = [
  {
    img: "svc-internal-transfers",
    alt: "Two warehouses connected by a curved arrow",
    title: "Internal stock transfers",
    body:
      "Moving your own inventory between your own sites, across a border. " +
      "No sale, no consignee change — which makes the paperwork different " +
      "and cheaper if it's filed right.",
    detail: "Stock transfer note · intra-company valuation",
  },
  {
    img: "svc-b2b-consignments",
    alt: "A full pallet of cartons beside a single carton",
    title: "B2B consignments",
    body:
      "Supplier to distributor, warehouse to retailer. Whole pallets or a " +
      "single carton — we don't have a minimum that turns small clients away.",
    detail: "1 carton to full pallet",
  },
  {
    img: "svc-consolidation",
    alt: "Four cartons converging into one shipping container",
    title: "Origin consolidation",
    body:
      "Several suppliers, one shipment. We receive at the origin gateway, " +
      "check every box against your PO, and fly one consolidated " +
      "consignment instead of five separate ones.",
    detail: "Photo-verified at intake",
  },
  {
    img: "svc-customs",
    alt: "A signed-off document beside a raised customs barrier",
    title: "Customs and clearance",
    body:
      "Bill of entry filed, duty reconciled, and the landed cost quoted " +
      "before you book rather than invoiced after.",
    detail: "BOE · duty reconciliation",
  },
  {
    img: "svc-storage",
    alt: "A warehouse holding stacked cartons, beside a clock",
    title: "Bonded and free storage",
    body:
      "Held at destination until you call it forward. Useful when your " +
      "own warehouse is full or a retailer's delivery window hasn't opened.",
    detail: "Navi Mumbai",
  },
  {
    img: "svc-last-mile",
    alt: "A carton passing from a warehouse into a box truck",
    title: "Last-mile handover",
    body:
      "We hand off to your courier with the AWB and the paperwork already " +
      "matched. Where you don't have one, we hand to ours.",
    detail: "Shiprocket · Delhivery · Bluedart",
  },
];

export default function Services() {
  return (
    <div id="services">
      <Reveal>
        <p className="text-eyebrow uppercase text-ink-tertiary">What we move</p>
        <h2 className="mt-2 max-w-2xl font-display text-[clamp(24px,4vw,36px)] leading-[1.1] font-semibold tracking-[-0.03em] text-ink text-balance">
          Freight between businesses, and between your own warehouses
        </h2>
        <p className="mt-3 max-w-xl text-body-sm text-ink-subtle">
          We move stock, not parcels. Our job starts at your supplier&apos;s dock
          and ends at your shelf, your distributor, or your courier — between
          businesses, between warehouses, between countries.
        </p>
        </Reveal>

        <Stagger className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((s) => (
          <StaggerItem key={s.title}>
            <article className="edge-lift group/card flex h-full flex-col rounded-xl border border-hairline bg-surface-1 p-5">
              {/* The illustration REPLACES the icon. Both is two visual
                  systems doing one job, and the card only needs a single
                  thing pulling the eye before the heading. */}
              <div className="relative -mx-1 aspect-[5/3] overflow-hidden rounded-lg bg-surface-2">
                <Image
                  src={`/services/${s.img}.webp`}
                  alt={s.alt}
                  fill
                  sizes="(min-width: 1024px) 340px, (min-width: 640px) 45vw, 88vw"
                  className="object-contain p-3"
                />
              </div>
              <h3 className="mt-4 font-display text-card-title font-semibold text-ink">
                {s.title}
              </h3>
              <p className="mt-2 flex-1 text-body-sm leading-relaxed text-ink-subtle">
                {s.body}
              </p>
              <p className="mt-4 border-t border-hairline pt-3 text-caption text-ink-tertiary">
                {s.detail}
              </p>
            </article>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
