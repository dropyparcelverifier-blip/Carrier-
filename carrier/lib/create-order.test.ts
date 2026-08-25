import { describe, expect, it } from "vitest";
import { validateNewOrder, type NewOrderInput } from "./create-order";

function baseOrder(overrides: Partial<NewOrderInput> = {}): NewOrderInput {
  return {
    us_order_id: "333-7777777-7777777",
    dropy_order_id: "DROPY-1001",
    tracking_id: "TRK123",
    customer_name: "Asha Rao",
    customer_mobile: "9876543210",
    customer_city: "Mumbai",
    shipping_days: 10,
    shipping_mode: "Air Freight",
    payment_status: "Unpaid",
    items: [{ name: "Moisturizer", qty: 1, weight_g: 200 }],
    ...overrides,
  };
}

describe("validateNewOrder", () => {
  it("accepts a well-formed order", () => {
    expect(validateNewOrder(baseOrder())).toBeNull();
  });

  it("requires a customer name", () => {
    expect(validateNewOrder(baseOrder({ customer_name: "  " }))).toMatch(/name/i);
  });

  it("requires exactly 10 digits for the mobile number", () => {
    expect(validateNewOrder(baseOrder({ customer_mobile: "12345" }))).toMatch(/mobile/i);
    expect(validateNewOrder(baseOrder({ customer_mobile: "123456789012" }))).toMatch(/mobile/i);
    expect(validateNewOrder(baseOrder({ customer_mobile: "98765abcde" }))).toMatch(/mobile/i);
  });

  it("rejects a malformed email but allows an empty one", () => {
    expect(validateNewOrder(baseOrder({ customer_email: "not-an-email" }))).toMatch(/email/i);
    expect(validateNewOrder(baseOrder({ customer_email: "" }))).toBeNull();
    expect(validateNewOrder(baseOrder({ customer_email: "a@b.com" }))).toBeNull();
  });

  it("requires a city", () => {
    expect(validateNewOrder(baseOrder({ customer_city: "" }))).toMatch(/city/i);
  });

  it("rejects a pincode that isn't exactly 6 digits, but allows omitting it", () => {
    expect(validateNewOrder(baseOrder({ customer_pincode: "12345" }))).toMatch(/pincode/i);
    expect(validateNewOrder(baseOrder({ customer_pincode: "" }))).toBeNull();
    expect(validateNewOrder(baseOrder({ customer_pincode: "400001" }))).toBeNull();
  });

  it("requires at least one item with a non-empty name", () => {
    expect(validateNewOrder(baseOrder({ items: [] }))).toMatch(/item/i);
    expect(validateNewOrder(baseOrder({ items: [{ name: "  ", qty: 1, weight_g: 100 }] }))).toMatch(/item/i);
  });

  it("rejects an item with quantity below 1", () => {
    const result = validateNewOrder(baseOrder({ items: [{ name: "Soap", qty: 0, weight_g: 100 }] }));
    expect(result).toMatch(/quantity/i);
  });

  it("rejects an item with non-positive weight", () => {
    const result = validateNewOrder(baseOrder({ items: [{ name: "Soap", qty: 1, weight_g: 0 }] }));
    expect(result).toMatch(/weight/i);
  });

  it("ignores blank rows when checking item quantity/weight", () => {
    // A blank placeholder row (e.g. from an "Add item" click never filled in)
    // shouldn't block submission as long as one real item is valid.
    const result = validateNewOrder(
      baseOrder({ items: [{ name: "Soap", qty: 1, weight_g: 100 }, { name: "", qty: 0, weight_g: 0 }] }),
    );
    expect(result).toBeNull();
  });

  it("requires the US order ID in the exact 333-7777777-7777777 format", () => {
    expect(validateNewOrder(baseOrder({ us_order_id: "12345" }))).toMatch(/US Order ID/i);
    expect(validateNewOrder(baseOrder({ us_order_id: "333-777-7777777" }))).toMatch(/US Order ID/i);
  });

  it("requires shipping days between 1 and 30 inclusive", () => {
    expect(validateNewOrder(baseOrder({ shipping_days: 0 }))).toMatch(/shipping days/i);
    expect(validateNewOrder(baseOrder({ shipping_days: 31 }))).toMatch(/shipping days/i);
    expect(validateNewOrder(baseOrder({ shipping_days: 1 }))).toBeNull();
    expect(validateNewOrder(baseOrder({ shipping_days: 30 }))).toBeNull();
  });

  it("rejects Ocean Freight — not an actual service today", () => {
    // Regression guard: Order Central (or any other caller) could otherwise
    // push an order through with shipping_mode: "Ocean Freight" just
    // because nothing stopped it at the validation layer, even though
    // Ocean Freight is disabled everywhere else in the app (see
    // lib/order-routes.ts).
    expect(validateNewOrder(baseOrder({ shipping_mode: "Ocean Freight" }))).toMatch(/shipping mode/i);
  });

  it("accepts Air Freight and Express Air", () => {
    expect(validateNewOrder(baseOrder({ shipping_mode: "Air Freight" }))).toBeNull();
    expect(validateNewOrder(baseOrder({ shipping_mode: "Express Air" }))).toBeNull();
  });

  it("rejects an unrecognized shipping mode", () => {
    expect(validateNewOrder(baseOrder({ shipping_mode: "Teleportation" }))).toMatch(/shipping mode/i);
  });
});
