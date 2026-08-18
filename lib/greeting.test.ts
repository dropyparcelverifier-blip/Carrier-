import { describe, expect, it } from "vitest";
import { firstName, orderGreeting, timeGreeting } from "./greeting";

describe("timeGreeting", () => {
  it("greets morning, afternoon, evening and night correctly", () => {
    expect(timeGreeting(new Date(2026, 0, 1, 3))).toBe("Good night");
    expect(timeGreeting(new Date(2026, 0, 1, 8))).toBe("Good morning");
    expect(timeGreeting(new Date(2026, 0, 1, 14))).toBe("Good afternoon");
    expect(timeGreeting(new Date(2026, 0, 1, 19))).toBe("Good evening");
    expect(timeGreeting(new Date(2026, 0, 1, 23))).toBe("Good night");
  });
});

describe("firstName", () => {
  it("takes the first token of a full name", () => {
    expect(firstName("Priya K.")).toBe("Priya");
    expect(firstName("Rahul")).toBe("Rahul");
    expect(firstName("  Anita   Sharma")).toBe("Anita");
  });
});

describe("orderGreeting", () => {
  it("includes an ETA for a non-delivered order, and greets by first name", () => {
    const { salutation, message } = orderGreeting(
      { status: "In Transit", contactName: "Priya K.", eta: "14 Aug 2026" },
      "Tomorrow",
      new Date(2026, 0, 1, 9),
    );
    expect(salutation).toBe("Good morning, Priya!");
    expect(message).toBe(
      "Your order is on the move, winging its way to India. Available tomorrow.",
    );
  });

  it("omits the ETA once delivered", () => {
    const { salutation, message } = orderGreeting(
      { status: "Received", contactName: "Rahul", eta: "01 Jan 2026" },
      "5 days ago",
      new Date(2026, 0, 1, 15),
    );
    expect(salutation).toBe("Good afternoon, Rahul!");
    expect(message).toBe("Your order has safely reached you — thanks for shipping with Dropy!");
  });

  it("falls back to the raw eta string when relativeDays can't parse it", () => {
    const { message } = orderGreeting(
      { status: "Customs Clearance", contactName: "Anita", eta: "14 Aug 2026" },
      null,
      new Date(2026, 0, 1, 10),
    );
    expect(message).toBe(
      "Almost there — your order is clearing customs in Mumbai. Available 14 Aug 2026.",
    );
  });
});
