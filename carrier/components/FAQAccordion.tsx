import { ChevronDown, HelpCircle } from "lucide-react";

export type FaqItem = { q: string; a: string };

// Every page that shows an FAQ has a different visitor intent — someone on
// /contact wants to know how to reach a person, someone on /track wants to
// know why their shipment looks a certain way, someone on /quote wants to
// know how much to trust the number they were just shown. A single shared
// list meant tracking-only questions ("How soon does a booking appear")
// showed up on /contact, and Contact-relevant questions (how fast is
// WhatsApp, can someone call) weren't anywhere. Each page now passes its
// own set instead.

export const HOME_FAQS: FaqItem[] = [
  {
    q: "Can you move our own stock between our own warehouses?",
    a: "Yes, and it's most of what we do. An internal transfer has no sale and no change of owner, which makes the customs treatment different — filed right, it's cheaper than an import. We handle the stock transfer documentation and the intra-company valuation.",
  },
  {
    q: "Is there a minimum? We only move a few cartons at a time.",
    a: "One carton. There's a minimum chargeable weight on air freight, and sea freight under 2 CBM costs more in origin charges than it's worth — but no account minimum and no volume floor.",
  },
  {
    q: "What kind of cargo do you handle?",
    a: "Small to medium-large consignments of general and everyday goods — personal care, apparel, electronics, household items and packaged general cargo. From a single carton up to full pallets, across five origin markets. We don't carry food, perishables, cold-chain or hazardous cargo. Where a category needs a specific regulatory clearance we handle the filing as part of the shipment, not as a separate service.",
  },
  {
    q: "How is this different from booking freight ourselves?",
    a: "We are the forwarder and the customs broker on one record — booking, the international leg, destination customs clearance, and the final handover all show up as one tracked shipment instead of separate vendor relationships you have to reconcile yourself.",
  },
  {
    q: "Do you only handle full container loads?",
    a: "No — LCL consolidations run weekly on the ocean routes, and air freight has no container minimum at all, just a minimum chargeable weight. Get a quote shows the real breakpoints for your category.",
  },
  {
    q: "How do we get pricing?",
    a: "Get a quote gives an indicative freight estimate from origin, weight and category in a few seconds. For a firm number against a real purchase order, send it to us directly and we return a landed-cost rate, usually by the next working day.",
  },
];

export const CONTACT_FAQS: FaqItem[] = [
  {
    q: "What's the fastest way to reach someone?",
    a: "Email, and we reply within 4 business hours. During office hours (Mon–Sat, 10:00–19:00 IST) the phone number on this page reaches a person directly.",
  },
  {
    q: "I want a rate, not just an answer to a question — what should I send?",
    a: "A recent purchase order with origin, category and weight. We return a landed-cost rate, a realistic transit window, and your HS classification, usually by the next working day.",
  },
  {
    q: "Can I call instead of emailing?",
    a: "Yes — the phone number on this page reaches our office directly during business hours. Outside those hours, email is the fastest route and we reply within 4 business hours.",
  },
  {
    q: "Do you take on new accounts, or only existing importers?",
    a: "Both. First-time importers get the same clearance and registration support as an existing account — tell us the category up front and we'll flag anything (CDSCO, FSSAI, licensing) that needs setting up before the first shipment moves.",
  },
];

export const TRACK_FAQS: FaqItem[] = [
  {
    q: "How soon does a new order appear in tracking?",
    a: "Within 30 minutes of the order being confirmed. It opens in the Order Placed state and moves forward as each stage — processing, dispatch, transit, customs, warehouse — is completed.",
  },
  {
    q: "Why do I need the registered phone number to search?",
    a: "It verifies your identity against the order — the tracking ID alone isn't treated as sufficient, since it's often visible on shipping labels or paperwork that changes hands. This prevents anyone else from pulling up your shipment's details.",
  },
  {
    q: "Can I search by company name instead of a tracking number?",
    a: "Not on this page — that would let anyone pull up every consignment moving under a given name. Lookup takes the exact tracking ID, order reference, or container/air-waybill number, plus the registered phone number.",
  },
  {
    q: "What happens when customs raises a query on my shipment?",
    a: "The shipment moves to an exception state, our clearance team is notified, and the query plus our response are attached to the tracking history so you can see exactly what's outstanding.",
  },
  {
    q: "The estimated arrival date changed — why?",
    a: "The date shown is when the consignment reaches our destination warehouse, calculated from the order date and the shipping window for that mode. It updates if the shipment moves faster or slower than that estimate — the tracking history always shows the real, recorded timestamps regardless of what the estimate says.",
  },
];

export const QUOTE_FAQS: FaqItem[] = [
  {
    q: "Is this a firm price, or an estimate?",
    a: "An indicative estimate, not a locked quote — it's a rule-based calculation, not a live carrier rate. Send us a real purchase order for a firm, landed-cost number.",
  },
  {
    q: "What's included in the number shown?",
    a: "Freight and handling for the leg from your selected origin to Mumbai. It does not include customs duty, which depends on the HS classification of the specific goods — that's part of the firm quote once you send a real order.",
  },
  {
    q: "What is chargeable weight, and why is it sometimes higher than the actual weight?",
    a: "Freight is billed against whichever is greater: the actual weight, or a volumetric weight calculated from the shipment's dimensions. Low-density, bulky cargo (think empty packaging, apparel) often hits the volumetric minimum before it hits the actual weight.",
  },
  {
    q: "How long is an estimate valid for?",
    a: "Treat it as a same-session ballpark — freight rates move with fuel surcharges and space availability, so for anything you're about to commit to, send us the real order and we'll return a rate that's actually held.",
  },
];

/**
 * Compact, single-column FAQ card — the app-shell counterpart to the wide
 * two-column FAQ section /about used to have (sticky image panel + list).
 * That layout doesn't fit Home/Track/Quote's phone-width single column, so
 * this is a plain card instead. Takes its content as a prop now — each
 * page passes its own FAQS constant above instead of one shared list.
 * `flat` drops the card border/shadow for Home specifically, where FAQ
 * was one more in a run of identical white bordered cards stacked down
 * the page (see HowItMoves.tsx's note) — Contact/Track/Quote keep the
 * card by default since each of those is a shorter, more isolated page
 * where a boxed FAQ doesn't repeat the same look 4-5 times in a row.
 */
export default function FAQAccordion({ items, flat = false }: { items: FaqItem[]; flat?: boolean }) {
  return (
    <div
        className={
          flat
              ? "relative"
              : "gradient-border edge-lift rounded-xl border border-hairline bg-surface-1 p-5 shadow-lg sm:p-6"
        }
    >
      <h2 className="flex items-center gap-1.5 text-body font-medium text-ink">
        <HelpCircle className="size-4 text-vivid-amber" strokeWidth={1.8} />
        Frequently asked
      </h2>
      {/*
          Each question is its own card, not a row in a divided list.
          A flat run of hairline-separated rows read as a plain list
          against a page built from cards — this matches the rest of the
          site and gives each answer its own surface to open into.
      */}
      <div className="mt-5 grid gap-3 @2xl:grid-cols-2">
        {items.map((item) => (
          <details
            key={item.q}
            className="faq-item edge-lift group rounded-xl border border-hairline bg-surface-1 px-5 py-4 shadow-sm transition-shadow duration-200 open:shadow-md hover:border-hairline-strong"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-body-sm font-medium text-ink marker:hidden">
              {item.q}
              <ChevronDown
                className="size-4 shrink-0 text-ink-tertiary transition-transform duration-300 group-open:rotate-180"
                strokeWidth={1.8}
              />
            </summary>
            <div className="faq-item-body grid transition-[grid-template-rows] duration-400 ease-out">
              <p className="min-h-0 overflow-hidden text-caption leading-relaxed text-ink-subtle">
                <span className="block border-t border-hairline pt-3 mt-3">{item.a}</span>
              </p>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
