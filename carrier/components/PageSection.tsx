import { Reveal } from "@/components/motion/primitives";
import { cx } from "@/components/ui";

/**
 * A leg of the page.
 *
 * Every section spans the full content column, at one uniform rhythm.
 *
 * There WAS an alternating 58%/42% offset here, sized so a scroll-linked
 * aircraft could fly up the clear side. That component is gone, and an
 * offset with nothing in the gap is not a design — it is 430px of dead
 * margin on four sections. Removed with it. If an offset ever comes back
 * it needs to be because something lives in the clear side.
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
 * 2. A SECTION'S CONTENT SIZES ITSELF OFF THIS BOX, NOT THE VIEWPORT.
 *    `@container` below is load-bearing: Services, Outcomes and
 *    HowItMoves choose their column counts with @-variants (@sm, @xl,
 *    @2xl, @4xl) that measure this element. Delete it and all three
 *    silently collapse to one column at every width, because none of
 *    their breakpoints will ever match.
 *
 *    It stays even though every section is now full width — it is what
 *    lets those three reflow correctly at 390/768/1024 without caring
 *    what the viewport is doing, and it is why they survived being
 *    narrowed before.
 *
 * Note `container-type: inline-size` (what `@container` compiles to)
 * applies layout containment, which makes this div a containing block
 * for any `position: fixed` descendant. So nothing `fixed` may be
 * rendered as a child of a section — it would be trapped by the section
 * instead of the viewport.
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
  space = "lg",
  rule = false,
  reveal = true,
  className,
  children,
}: {
  id?: string;
  /** Stable name for this section, surfaced as data-leg. */
  leg?: string;
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
      className={cx(
        "relative",
        SPACE[space],
        rule && "border-t border-hairline",
        className,
      )}
    >
      <div
        // Kept as a hook so the rendered content width can be measured
        // directly from the DOM rather than inferred from classes.
        data-leg-body=""
        // @container is required, not decorative — see note 2 above.
        className="@container relative"
      >
        {reveal ? <Reveal>{children}</Reveal> : children}
      </div>
    </section>
  );
}
