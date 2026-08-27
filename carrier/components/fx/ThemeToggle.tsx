"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cx } from "../ui";

type Theme = "light" | "dark";

/**
 * The theme is already resolved and stamped on <html> by the inline script in
 * app/layout.tsx, so this only has to read it back and let the user flip it.
 */
export default function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("dc-theme", next);
    } catch {
      /* private mode — the choice just won't persist */
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        theme === "light" ? "Switch to dark theme" : "Switch to light theme"
      }
      className={cx(
        "relative flex size-11 items-center justify-center rounded-md border border-hairline bg-surface-2 text-ink-subtle transition-colors duration-200 hover:border-hairline-strong hover:text-ink md:size-9",
        className,
      )}
    >
      {/* Render both and cross-fade, so nothing pops in after hydration. */}
      <Sun
        className={cx(
          "absolute size-4 transition-all duration-300",
          theme === "light"
            ? "scale-0 -rotate-90 opacity-0"
            : "scale-100 rotate-0 opacity-100",
        )}
        strokeWidth={1.9}
      />
      <Moon
        className={cx(
          "absolute size-4 transition-all duration-300",
          theme === "light"
            ? "scale-100 rotate-0 opacity-100"
            : "scale-0 rotate-90 opacity-0",
        )}
        strokeWidth={1.9}
      />
    </button>
  );
}
