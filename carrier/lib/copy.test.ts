import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { CLEARANCE, FACILITIES } from "@/lib/network";

/**
 * The site does not describe MRP labelling or any relabelling of goods —
 * not in the quote note, the "not the cheapest" card, the clearance steps
 * or the warehouse role. Pinned so the wording can't creep back.
 */
const ROOT = path.resolve(import.meta.dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [full] : [];
  });
}

const RETIRED = ["MRP", "labelling", "label mismatches", "Label claims", "Hold, label"];

describe("no labelling copy", () => {
  it("no page, component or lib file mentions MRP or labelling", () => {
    const hits: string[] = [];
    for (const dir of ["app", "components", "lib"]) {
      for (const file of sourceFiles(path.join(ROOT, dir))) {
        const text = readFileSync(file, "utf8");
        for (const needle of RETIRED) if (text.includes(needle)) hits.push(`${path.relative(ROOT, file)}: ${needle}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("the customs check lists what it still checks, and nothing about labels", () => {
    const exam = CLEARANCE.find((s) => s.title === "Physical verification")!;
    expect(exam.checks).toEqual([
      "Carton count and gross weight against the declaration",
      "Batch and expiry read from the packs, residual shelf life confirmed",
      "Duty assessed, paid, out-of-charge issued",
    ]);
  });

  it("the bonded warehouse holds, checks and releases", () => {
    expect(FACILITIES.find((f) => f.name === "Bonded warehouse")!.role).toBe("Hold, check, release");
  });
});
