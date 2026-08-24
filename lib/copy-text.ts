/**
 * Copy-to-clipboard that works outside a secure context.
 *
 * navigator.clipboard is only defined on HTTPS or localhost. On a plain
 * http LAN address — http://192.168.1.12:3000, which is how any of this
 * gets tested on a real phone — it is undefined, and calling
 * .writeText on it throws a TypeError that takes the whole page down.
 *
 * Production is HTTPS so this never fires for a customer. But an
 * unguarded call to an API that isn't always present is a bug regardless
 * of whether today's deployment happens to hide it, and it made both the
 * tracking page and the admin panel crash on any phone test.
 *
 * document.execCommand("copy") is deprecated but works everywhere,
 * including exactly the insecure contexts the modern API refuses to
 * serve.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or a non-focused document — fall through
      // rather than reporting failure while a working path remains.
    }
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    // Off-screen, not display:none — a hidden element cannot be
    // selected, so the copy would silently do nothing.
    el.style.position = "fixed";
    el.style.top = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
