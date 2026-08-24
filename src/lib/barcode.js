/**
 * Generate barcode-stripe geometry from a tracking number.
 * Deterministic — the same tracking always renders the same stripe,
 * so the on-screen record visually matches its physical label.
 */
export function barSet(str, height = 38, scale = 1.5) {
    if (!str) return [];
    const out = [];
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        const h = height - (c % 4) * (height * 0.11);
        out.push({ w: ((c % 3) + 1) * scale, h, faint: false });
        out.push({ w: ((c >> 2) % 2) + 1, h, faint: true });
    }
    return out;
}
