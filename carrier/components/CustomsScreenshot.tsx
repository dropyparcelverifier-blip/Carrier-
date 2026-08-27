import { DEMO_SHIPMENTS } from "@/lib/demo-data";
import { cx } from "./ui";

const DOCUMENTS = [
  { name: "Commercial invoice", state: "Verified", file: "INV-88410293.pdf" },
  { name: "Packing list with batch schedule", state: "Verified", file: "PL-88410293.pdf" },
  { name: "Air waybill", state: "Verified", file: "AWB-176-88410293.pdf" },
  { name: "CDSCO registration certificate", state: "Verified", file: "COS-2-2025-38104.pdf" },
  { name: "Certificate of origin", state: "Verified", file: "COO-US-2026.pdf" },
  { name: "Bill of entry", state: "Filed", file: "BOE-4471982.pdf" },
];

const DUTY_LINES = [
  ["Assessable value (CIF)", "₹ 1,84,29,800"],
  ["Basic customs duty @ 20%", "₹ 36,85,960"],
  ["Social welfare surcharge @ 10%", "₹ 3,68,596"],
  ["IGST @ 18%", "₹ 40,47,193"],
];

const CHECKLIST: [string, boolean][] = [
  ["IEC validated", true],
  ["Import licence verified", true],
  ["HS classification confirmed", true],
  ["Bill of entry filed", true],
  ["Assessment complete", false],
  ["Out-of-charge issued", false],
];

/** Second product panel — the customs and compliance desk. */
export default function CustomsScreenshot() {
  const s = DEMO_SHIPMENTS[1];

  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-canvas">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-surface-2 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-ink-subtle">{s.id}</span>
          <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-ink-muted">
            Customs &amp; compliance desk
          </span>
        </div>
        <span className="font-mono text-[11px] text-ink-tertiary">
          HS {s.hsCode} · BOE 4471982
        </span>
      </div>

      <div className="grid gap-px bg-hairline md:grid-cols-[1.2fr_1fr]">
        {/* documents */}
        <div className="bg-canvas p-4">
          <p className="text-[11px] text-ink-tertiary">Document vault</p>
          <ul className="mt-3 flex flex-col gap-px overflow-hidden rounded-sm border border-hairline-tertiary">
            {DOCUMENTS.map((doc) => (
              <li
                key={doc.name}
                className="flex items-center justify-between gap-3 bg-surface-1 px-3 py-2.5 transition-colors hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[12px] text-ink">{doc.name}</p>
                  <p className="truncate font-mono text-[11px] text-ink-tertiary">
                    {doc.file}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-muted">
                  <span
                    aria-hidden
                    className={cx(
                      "size-1.5 rounded-full",
                      doc.state === "Verified"
                        ? "bg-semantic-success"
                        : "bg-primary",
                    )}
                  />
                  {doc.state}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* duty + checklist */}
        <div className="bg-canvas p-4">
          <p className="text-[11px] text-ink-tertiary">Landed cost estimate</p>
          <dl className="mt-3 flex flex-col gap-2.5 rounded-sm border border-hairline-tertiary bg-surface-1 p-3">
            {DUTY_LINES.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 text-[12px]">
                <dt className="text-ink-subtle">{k}</dt>
                <dd className="font-mono text-ink-muted">{v}</dd>
              </div>
            ))}
            <div className="mt-1 flex justify-between gap-3 border-t border-hairline pt-2.5 text-[12px]">
              <dt className="text-ink">Total duty payable</dt>
              <dd className="font-mono text-ink">₹ 81,01,749</dd>
            </div>
          </dl>

          <div className="mt-4 rounded-sm border border-hairline-tertiary bg-surface-1 p-3">
            <p className="text-[11px] text-ink-tertiary">Clearance checklist</p>
            <ul className="mt-2.5 flex flex-col gap-2 text-[12px]">
              {CHECKLIST.map(([label, done]) => (
                <li key={label} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cx(
                      "flex size-3.5 shrink-0 items-center justify-center rounded-xs border",
                      done
                        ? "border-semantic-success bg-semantic-success/15"
                        : "border-hairline-strong",
                    )}
                  >
                    {done ? (
                      <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
                        <path
                          d="M2 5.2 4 7.2 8 3"
                          fill="none"
                          className="stroke-semantic-success"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </span>
                  <span className={done ? "text-ink-muted" : "text-ink-subtle"}>
                    {label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
