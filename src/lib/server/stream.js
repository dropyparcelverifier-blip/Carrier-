/**
 * Which warehouse a request is about.
 *
 * Defaults to Dropy, so every screen written before Bombino existed keeps
 * behaving exactly as it did. Anything unrecognised also falls back to Dropy
 * rather than showing both — a mixed list is worse than a narrow one.
 */
export function streamOf(url) {
    const s = url?.searchParams?.get('stream');
    return s === 'bm' ? 'bm' : 'dropy';
}
