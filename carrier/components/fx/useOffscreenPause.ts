"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Decorative, always-looping animations (aurora blur, SMIL flight paths)
 * keep animating and compositing even when scrolled far out of view — pure
 * wasted GPU/main-thread work. This pauses them via IntersectionObserver
 * once they're a full viewport away, and resumes just before they re-enter.
 */
export function useOffscreenPause<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "50% 0px 50% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, active };
}
