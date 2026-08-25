import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export function Container({
  children,
  className,
  wide = false,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cx(
        "relative mx-auto w-full px-5 sm:px-6 md:px-8",
        wide ? "max-w-wide" : "max-w-content",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Section({
  children,
  className,
  id,
  glow = false,
  tone = "canvas",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  /** Ambient wash so a section is never a flat field. */
  glow?: boolean;
  /**
   * Alternating band colour. Consecutive sections should alternate so the
   * page reads as a sequence rather than one continuous scroll.
   */
  tone?: "canvas" | "raised";
}) {
  return (
    <section
      id={id}
      className={cx(
        // scroll-mt keeps anchor jumps clear of the fixed nav
        "relative scroll-mt-24 py-14 md:py-24",
        tone === "raised" && "band-raised border-y border-hairline",
        glow && "section-glow",
        className,
      )}
    >
      <Container>{children}</Container>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Type                                                               */
/* ------------------------------------------------------------------ */

export function Eyebrow({
  children,
  icon: Icon,
}: {
  children: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-1/80 px-3 py-1.5 text-eyebrow uppercase text-ink-subtle shadow-xs backdrop-blur-sm">
      {Icon ? <Icon className="size-3.5 text-primary" strokeWidth={2} /> : null}
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  eyebrowIcon,
  title,
  body,
  align = "left",
  className,
}: {
  eyebrow?: string;
  eyebrowIcon?: LucideIcon;
  title: ReactNode;
  body?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col gap-5",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow ? <Eyebrow icon={eyebrowIcon}>{eyebrow}</Eyebrow> : null}
      <h2 className="max-w-3xl font-display text-[clamp(28px,4vw,48px)] leading-[1.08] font-semibold tracking-[-0.035em] text-ink text-balance">
        {title}
      </h2>
      {body ? (
        <p
          className={cx(
            "max-w-2xl text-body-lg text-ink-subtle",
            align === "center" && "mx-auto",
          )}
        >
          {body}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                            */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "inverse";
type ButtonSize = "sm" | "md" | "lg";

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3.5 text-button",
  md: "min-h-11 px-5 text-button",
  lg: "min-h-12 px-6 text-body-sm",
};

const variants: Record<ButtonVariant, string> = {
  /*
   * A gradient fill rather than a flat one gives the primary action real
   * depth — the same `.fill-primary` two-stop gradient IconTile uses.
   * Hover brightens the glow (floating higher); active flattens both the
   * gradient's lift and the glow's spread (`active:shadow-none` layers
   * under buttonBase's `active:translate-y-px`) so pressing it reads as
   * sinking the button in, not just dimming a colour.
   */
  primary:
    "fill-primary text-on-primary shadow-glow hover:shadow-glow-lg hover:brightness-110 active:shadow-none active:brightness-95",
  /*
   * `edge-lift` adds the same top-edge highlight Card/ProductPanel use, so
   * this reads as a raised bevel rather than a flat tinted rectangle —
   * the secondary/neumorphic counterpart to primary's gradient fill.
   */
  secondary:
    "edge-lift border border-hairline bg-surface-2/80 text-ink shadow-sm backdrop-blur-sm hover:border-hairline-strong hover:bg-surface-3 active:shadow-none",
  ghost: "text-ink-subtle hover:bg-surface-2 hover:text-ink",
  inverse:
    "bg-inverse-canvas text-inverse-ink shadow-md hover:bg-inverse-surface-1",
};

const buttonBase =
  "shine group/btn relative inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-all duration-300 ease-out active:translate-y-px active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none";

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  icon: Icon,
  children,
  ...props
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
} & ComponentProps<typeof Link>) {
  return (
    <Link
      className={cx(buttonBase, sizes[size], variants[variant], className)}
      {...props}
    >
      <span className="relative z-10 inline-flex items-center gap-2">
        {children}
        {Icon ? (
          <Icon
            className="size-4 transition-transform duration-300 group-hover/btn:translate-x-0.5"
            strokeWidth={2}
          />
        ) : null}
      </span>
    </Link>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  icon: Icon,
  children,
  ...props
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
} & ComponentProps<"button">) {
  return (
    <button
      className={cx(buttonBase, sizes[size], variants[variant], className)}
      {...props}
    >
      <span className="relative z-10 inline-flex items-center gap-2">
        {children}
        {Icon ? (
          <Icon
            className="size-4 transition-transform duration-300 group-hover/btn:translate-x-0.5"
            strokeWidth={2}
          />
        ) : null}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                           */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  className,
  lifted = false,
  interactive = true,
  glass = false,
  accent,
}: {
  children: ReactNode;
  className?: string;
  lifted?: boolean;
  interactive?: boolean;
  /** Frosted/translucent surface instead of the opaque default — for a
   *  card that floats over photography or other page content. */
  glass?: boolean;
  /**
   * Background class for a colour key down the card's left edge, e.g.
   * "bg-semantic-info". Rendered outside the padded content so it sits on the
   * card edge rather than over the text.
   */
  accent?: string;
}) {
  return (
    <div
      className={cx(
        "gradient-border edge-lift relative overflow-hidden rounded-lg transition-all duration-400 ease-out",
        glass
          ? "glass shadow-lg"
          : lifted
            ? "bg-surface-2 shadow-lg"
            : "bg-surface-1 shadow-md",
        interactive && "spotlight hover:-translate-y-1 hover:shadow-xl active:translate-y-0 active:shadow-md",
        className,
      )}
    >
      {accent ? (
        <span
          aria-hidden
          className={cx("absolute inset-y-0 left-0 z-[2] w-[3px]", accent)}
        />
      ) : null}
      <div className="relative z-[1] flex h-full flex-col p-6 md:p-7">
        {children}
      </div>
    </div>
  );
}

/** Frames a product-UI mockup. The heaviest elevation on the page. */
export function ProductPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "gradient-border edge-lift relative overflow-hidden rounded-xxl bg-surface-1/70 p-2 shadow-xl backdrop-blur-xl md:p-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export type IconTone =
  | "primary"
  | "violet"
  | "blue"
  | "cyan"
  | "green"
  | "amber"
  | "coral"
  | "pink"
  | "indigo";

/** Solid gradient fill (globals.css `.fill-*`) + a matching glow shadow tint. */
export const ICON_TONE: Record<IconTone, string> = {
  primary: "fill-primary shadow-primary/35",
  violet: "fill-violet shadow-vivid-violet/35",
  blue: "fill-blue shadow-vivid-blue/35",
  cyan: "fill-cyan shadow-vivid-cyan/35",
  green: "fill-green shadow-vivid-green/35",
  amber: "fill-amber shadow-vivid-amber/35",
  coral: "fill-coral shadow-vivid-coral/35",
  pink: "fill-pink shadow-vivid-pink/35",
  indigo: "fill-indigo shadow-vivid-indigo/35",
};

/**
 * Square icon chip used across cards and list rows. Solid colour-filled
 * gradient (not a tint on a bordered chip) with a white icon and a
 * colour-matched glow, so it reads as a small floating object rather than a
 * flat label — defaults to the brand primary, but a page of all-primary
 * tiles reads as one flat note, so most call sites should pass a distinct
 * `tone` for variety, the way a consumer app's icon grid does.
 */
export function IconTile({
  icon: Icon,
  className,
  size = "md",
  tone = "primary",
}: {
  icon: LucideIcon;
  className?: string;
  size?: "sm" | "md";
  tone?: IconTone;
}) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-md text-white shadow-lg transition-all duration-300 ease-out hover:-translate-y-0.5 hover:scale-105 active:scale-95 active:shadow-sm",
        ICON_TONE[tone],
        size === "md" ? "size-11" : "size-9",
        className,
      )}
    >
      <Icon
        className={size === "md" ? "size-5" : "size-4"}
        strokeWidth={2}
      />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Status                                                             */
/* ------------------------------------------------------------------ */

export function StatusBadge({
  children,
  tone = "default",
  className,
  pulse = false,
}: {
  children: ReactNode;
  tone?: "default" | "success" | "attention";
  className?: string;
  pulse?: boolean;
}) {
  const dot =
    tone === "success"
      ? "bg-semantic-success"
      : tone === "attention"
        ? "bg-accent"
        : "bg-primary";

  // A tinted border + glass fill per tone instead of one neutral chip for
  // every tone — a small dot alone doesn't read as "success" at a glance,
  // the whole pill's colour should.
  const chrome =
    tone === "success"
      ? "border-semantic-success/30 bg-semantic-success/10 text-ink-muted"
      : tone === "attention"
        ? "border-accent/35 bg-accent/10 text-ink-muted"
        : "border-hairline bg-surface-1/80 text-ink-muted";

  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-caption shadow-xs backdrop-blur-sm",
        chrome,
        className,
      )}
    >
      <span className="relative flex size-1.5">
        {pulse ? (
          <span
            className={cx("pulse-ring absolute inline-flex size-full rounded-full", dot)}
          />
        ) : null}
        <span className={cx("relative inline-flex size-1.5 rounded-full", dot)} />
      </span>
      {children}
    </span>
  );
}
