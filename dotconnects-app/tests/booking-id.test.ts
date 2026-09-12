import { describe, it, expect } from "vitest";
import { bookingId } from "../src/lib/booking-id";

describe("bookingId", () => {
  it("prefixes a plain order with #", () => expect(bookingId("Dropy-4251")).toBe("#Dropy-4251"));
  it("shows the parent order for a split leg", () => {
    expect(bookingId("Dropy-4251-1")).toBe("#Dropy-4251");
    expect(bookingId("Dropy-4251-2")).toBe("#Dropy-4251");
  });
  it("never strips the order number itself", () => expect(bookingId("Dropy-4251")).not.toBe("#Dropy"));
  it("does not double a # that is already there", () => expect(bookingId("#Dropy-4982")).toBe("#Dropy-4982"));
  it("leaves other references alone", () => expect(bookingId("ORD-9981")).toBe("#ORD-9981"));
  it("shows a dash when there is nothing", () => {
    expect(bookingId("")).toBe("—");
    expect(bookingId(null)).toBe("—");
  });
});
