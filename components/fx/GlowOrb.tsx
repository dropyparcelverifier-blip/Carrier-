import { cx } from "../ui";

/**
 * A single blurred color blob for page backgrounds — the same technique as
 * the top-of-page ambient glow on Home/Track/Quote, factored out so it can
 * be dropped at multiple scroll depths with different sizes/colors instead
 * of every page hand-rolling its own radial-gradient string. Unlike
 * fx/Backdrop (grain + animated aurora, reserved for hero sections), this is
 * a plain static div — cheap enough to place several per page.
 */
export default function GlowOrb({
  color,
  size = "size-[26rem]",
  opacity = 16,
  className,
}: {
  /** A CSS custom property name, e.g. "--color-primary" or "--color-vivid-blue". */
  color: string;
  size?: string;
  opacity?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cx(
        "pointer-events-none absolute -z-10 rounded-full blur-[50px] md:blur-[90px]",
        size,
        className,
      )}
      style={{
        background: `color-mix(in srgb, var(${color}) ${opacity}%, transparent)`,
      }}
    />
  );
}
