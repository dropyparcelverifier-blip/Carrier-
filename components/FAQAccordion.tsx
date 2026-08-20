import { ChevronDown } from "lucide-react";

export const FAQS = [
  {
    q: "How soon does a new booking appear in tracking?",
    a: "Within 30 minutes of the booking being confirmed. The shipment opens in the Booked state with the scheduled pickup date and moves forward as scans arrive.",
  },
  {
    q: "Can I search by my company name instead of a tracking number?",
    a: "Not on the public page — that would let anyone pull up every consignment moving under your name. Public lookup takes the exact tracking number, PO reference, or container / air-waybill number. Searching across all of your shipments sits behind your client sign-in.",
  },
  {
    q: "Do you handle CDSCO cosmetic import registration?",
    a: "We manage the registration and keep it current, and check your existing certificate covers every SKU on the order before it ships. Registration sits with the importer; we do the filing and the follow-up.",
  },
  {
    q: "What about supplements and nutraceuticals?",
    a: "Those clear under FSSAI rather than CDSCO. We pre-file the import clearance, verify residual shelf life against the batch schedule, and check label claims before the goods leave origin.",
  },
  {
    q: "What happens when customs raises a query?",
    a: "The shipment moves to an exception state, your named clearance agent is notified, and the query plus our response are attached to the tracking history so you can see exactly what is outstanding.",
  },
];

/**
 * Compact, single-column FAQ card — the app-shell counterpart to the wide
 * two-column FAQ section /about used to have (sticky image panel + list).
 * That layout doesn't fit Home/Track's phone-width single column, so this
 * is a plain card instead; same FAQS data and the same `.faq-item` /
 * `.faq-item-body` CSS (globals.css) that drives the collapse animation.
 */
export default function FAQAccordion() {
  return (
    <div className="gradient-border edge-lift rounded-xl border border-hairline bg-surface-1 p-5 shadow-lg sm:p-6">
      <h2 className="text-body font-medium text-ink">Frequently asked</h2>
      <div className="mt-2 flex flex-col">
        {FAQS.map((item) => (
          <details key={item.q} className="faq-item group border-b border-hairline py-4 last:border-0">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-2 text-body-sm text-ink marker:hidden">
              {item.q}
              <ChevronDown
                className="size-4 shrink-0 text-ink-tertiary transition-transform duration-300 group-open:rotate-180"
                strokeWidth={1.8}
              />
            </summary>
            <div className="faq-item-body grid transition-[grid-template-rows] duration-400 ease-out">
              <p className="min-h-0 overflow-hidden text-caption text-ink-subtle">
                <span className="block pt-3">{item.a}</span>
              </p>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
