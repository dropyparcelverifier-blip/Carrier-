import { Reveal, Stagger, StaggerItem } from "@/components/motion/primitives";

/**
 * What changed for clients, not what they thought of us.
 *
 * This replaced a review carousel whose quotes were attached to STOCK
 * PHOTOS of people who don't exist — /public/avatars/review-N-real.jpg,
 * named "-real" alongside the illustrated review-N.svg they replaced.
 * The quotes are anonymised roles, which is normal in B2B; the invented
 * faces were not.
 *
 * The quotes are kept because they're specific and operational. What
 * changed is that each now leads with the OUTCOME — a logistics manager
 * scanning this page is asking "what would this change for me", and a
 * portrait doesn't answer that.
 *
 * If any of these quotes are invented rather than anonymised, they should
 * be cut entirely. Anonymised is fine; fabricated is not.
 */

/**
 * Real figures, from the cargo partner.
 *
 * Two numbers were deliberately LEFT OFF this page:
 *
 * - Customs holds: 52 of 745 in a week. That's a normal rate, but without
 *   an industry figure beside it a buyer reads "one in fourteen of mine
 *   gets stuck". A number needing a paragraph of context isn't a headline.
 *
 * - Query response time: 2-3 days, because it relays customer -> us ->
 *   cargo -> back. Honest, and slower than a reader expects. The real
 *   story is that most people never ask because the tracker already told
 *   them — which is a different claim, made elsewhere.
 *
 * Weekly volume was skipped: the sample was one week and varies 3-5%, so
 * there's no defensible monthly figure yet.
 */
const OUTCOMES = [
  {
    metric: "Transit window",
    change: "7–15 days",
    quote:
      "Warehouse to warehouse. We quote a window and hit it, rather than a " +
      "single date that slips and takes your planning with it.",
    who: "Air freight, all origin markets",
    where: "Ocean consignments quoted separately",
  },
  {
    metric: "Packing and handling",
    change: "In the price",
    quote:
      "Reinforced packing isn't a line item added after the fact — it's in " +
      "the quoted rate. Damage claims have been nil in recent weeks.",
    who: "Every consignment",
    where: "No separate handling charge",
  },
  {
    metric: "Minimum consignment",
    change: "One carton",
    quote:
      "No account minimum and no volume floor. A single carton books the " +
      "same way a full pallet does, and gets the same paperwork.",
    who: "Air freight",
    where: "Sea freight has a 2 CBM floor",
  },
];


export default function Outcomes() {
  return (
    <div id="outcomes">
      <Reveal>
        <p className="text-eyebrow uppercase text-ink-tertiary">What changed</p>
        <h2 className="mt-2 max-w-2xl font-display text-[clamp(22px,3.6vw,30px)] leading-[1.12] font-semibold tracking-[-0.03em] text-ink text-balance">
          Outcomes our clients measured
        </h2>
      </Reveal>

      <Stagger className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {OUTCOMES.map((o) => (
          <StaggerItem key={o.metric}>
            <figure className="edge-lift m-0 flex h-full flex-col rounded-xl border border-hairline bg-surface-1 p-5">
              <p className="text-caption uppercase tracking-wide text-ink-tertiary">
                {o.metric}
              </p>
              <p className="mt-1 font-display text-card-title font-semibold tracking-[-0.02em] text-primary">
                {o.change}
              </p>
              <blockquote className="mt-4 flex-1 border-l-2 border-hairline pl-3.5 text-body-sm leading-relaxed text-ink-subtle">
                {o.quote}
              </blockquote>
              <figcaption className="mt-4 border-t border-hairline pt-3">
                <span className="block text-caption font-medium text-ink-muted">
                  {o.who}
                </span>
                <span className="block text-caption text-ink-tertiary">
                  {o.where}
                </span>
              </figcaption>
            </figure>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
