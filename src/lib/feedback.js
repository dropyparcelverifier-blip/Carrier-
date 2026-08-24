/**
 * Something a person can hear and feel.
 *
 * With continuous scanning there is no button press to confirm a read, so the
 * only signal that anything happened is the screen — which a packer holding a
 * box is often not looking at. A tone and a buzz carry it without eyes.
 */

let ctx = null;

function audio() {
    if (ctx) return ctx;
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    ctx = new A();
    return ctx;
}

function tone(freq, ms, gain = 0.09) {
    const c = audio();
    if (!c) return;
    // iOS suspends audio until a gesture; a scan follows one, so this resumes
    if (c.state === 'suspended') c.resume().catch(() => {});

    const osc = c.createOscillator();
    const vol = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    vol.gain.setValueAtTime(gain, c.currentTime);
    vol.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + ms / 1000);
    osc.connect(vol).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + ms / 1000);
}

function buzz(pattern) {
    // Android honours this; iOS Safari ignores it, which is why the tone matters
    try { navigator.vibrate?.(pattern); } catch {}
}

/** A parcel was logged. */
export function ok() {
    tone(880, 90);
    buzz(45);
}

/** Already scanned — a softer, lower note, so it is distinguishable without looking. */
export function repeat() {
    tone(520, 70, 0.06);
    buzz([25, 60, 25]);
}

/** Something went wrong. */
export function bad() {
    tone(220, 200, 0.11);
    buzz([70, 60, 70]);
}

/** Called from a tap, so the browser lets audio play later without a gesture. */
export function unlock() {
    const c = audio();
    if (c?.state === 'suspended') c.resume().catch(() => {});
}
