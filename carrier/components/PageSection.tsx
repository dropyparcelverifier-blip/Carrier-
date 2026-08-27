import { Reveal } from "@/components/motion/primitives";
import { cx } from "@/components/ui";

/**
 * A leg of the page.
 *
 * The homepage was a single stacked column — every section full width,
 * separated by hairlines, at a uniform rhythm. Readable, but nothing had
 * a shape, and there was nowhere for the flight path to go except
 * straight down behind the text.
 *
 * Sections now alternate left, right and full. The aircraft crosses the
 * empty side, which gives the whitespace a job instead of leaving it as
 * padding.
 *
 * `align` is deliberately explicit per section rather than derived from
 * an index: some sections (the map, the stats band) need full width to
 * work, and an automatic alternation would fight them.
 *
 * TWO THINGS THIS GOT WRONG THE FIRST TIME, both of which shipped green:
 *
 * 1. SPACING. It used py-20/md:py-28 while every sibling on the page was
 *    still on mt-8/mt-10. Two adjacent sections contributed 224px of gap
 *    where the rest of the page used 32px, so the converted sections read
 *    as holes rather than as breathing room. The fix is not a smaller
 *    number in isolation — it is that EVERY section on the page is a
 *    PageSection, so the rhythm is uniform by construction. The scale
 *    below is stated as the gap each section contributes to EACH of its
 *    neighbours; the visible gap between two sections is the sum of the
 *    two.
 *
 * 2. THE OFFSET COLUMN NARROWS ITS CONTENT, AND THE CONTENT HAS TO KNOW.
 *    Services, Outcomes and HowItMoves size their grids off VIEWPORT
 *    breakpoints (sm:/md:/lg:). Dropped into a 58% column on a 1440px
 *    screen, `lg:grid-cols-3` still fired — three cards in 594px, one
 *    word per line. `@container` here is what makes the offset safe:
 *    those three now use @-variants that measure this box, so they go
 *    2-up (or 1-up) when the column narrows and 3-up when it doesn't.
 *    Anything dropped into an offset section must do the same.
 *
 * Note `container-type: inline-size` (what `@container` compiles to)
 * applies layout containment, which makes this div a containing block
 * for any `position: fixed` descendant. That is fine here — FlightPath
 * mounts at the page root, not inside a section — but it is the reason
 * nothing fixed may be rendered as a child of one.
 */

/** Gap contributed to EACH neighbour. The visible gap is the sum of two. */
const SPACE = {
  none: "",
  /** Top of page: Container already supplies the nav clearance above. */
  hero: "pb-12 md:pb-16",
  sm: "py-5 md:py-7",
  md: "py-8 md:py-11",
  lg: "py-12 md:py-16",
  xl: "py-14 md:py-20",
} as const;

export default function PageSection({
  id,
  leg,
  align = "full",
  space = "lg",
  rule = false,
  reveal = true,
  className,
  children,
}: {
  id?: string;
  /** Waypoint name for the flight path. Omit to skip this section. */
  leg?: string;
  align?: "left" | "right" | "full";
  space?: keyof typeof SPACE;
  /** Hairline above, marking the start of a new movement on the page. */
  rule?: boolean;
  /**
   * Off when the child already animates itself (a Stagger, or a block
   * with its own per-element Reveals) — nesting a Reveal around one of
   * those fades the whole group in and then animates it again inside.
   */
  reveal?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      data-leg={leg}
      // FlightPath reads this rather than counting siblings: which side is
      // clear is a property of the section, not of its position in a list.
      data-align={align}
      className={cx(
        "relative",
        SPACE[space],
        rule && "border-t border-hairline",
        className,
      )}
    >
      <div
        // FlightPath measures THIS box, not the section, to find the clear
        // side: the section always spans the full column, the body is what
        // the offset actually narrows.
        data-leg-body=""
        className={cx(
          "@container relative",
          // 58% on a wide screen leaves ~40% clear for the aircraft to
          // cross. Below lg everything is full width — on a phone an
          // offset column is just a narrower column.
          align === "left" && "lg:mr-auto lg:w-[58%]",
          align === "right" && "lg:ml-auto lg:w-[58%]",
        )}
      >
        {reveal ? <Reveal>{children}</Reveal> : children}
      </div>
    </section>
  );
}
