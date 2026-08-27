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
 */
export default function PageSection({
  id,
  leg,
  align = "full",
  space = "lg",
  className,
  children,
}: {
  id?: string;
  /** Waypoint name for the flight path. Omit to skip this section. */
  leg?: string;
  align?: "left" | "right" | "full";
  space?: "md" | "lg" | "xl";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      data-leg={leg}
      className={cx(
        "relative",
        // Generous vertical rhythm. The old spacing was pt-8/pt-10 with a
        // hairline between — enough to separate, not enough to let a
        // section breathe or a flight path pass.
        space === "md" && "py-14 md:py-20",
        space === "lg" && "py-20 md:py-28",
        space === "xl" && "py-24 md:py-36",
        className,
      )}
    >
      <div
        className={cx(
          "relative",
          // 58% on a wide screen leaves ~40% clear for the aircraft to
          // cross. Below lg everything is full width — on a phone an
          // offset column is just a narrower column.
          align === "left" && "lg:mr-auto lg:w-[58%]",
          align === "right" && "lg:ml-auto lg:w-[58%]",
        )}
      >
        <Reveal>{children}</Reveal>
      </div>
    </section>
  );
}
