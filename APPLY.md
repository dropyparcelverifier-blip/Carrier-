# Apply — real Shiprocket statuses + shareable tracking links

Extract INTO `DotConnects Logistics`. Overwrite.

    cd dotconnects-app
    npm install
    npx svelte-kit sync
    npx tsc --noEmit ; npx vitest run ; npx vite build     # 371 tests

    cd ..
    git add -A
    git commit -m "Shiprocket statuses rewritten from 775 real webhooks; shareable /tracking/:id links"
    git push origin main

Vercel redeploys on push.

---

# The status list was wrong for a fifth of live traffic

Your 775 captured webhooks settled it. The docs-derived list ignored **164 of
775 events**, and ten statuses in it have **never once been sent**:

    awb assigned · awb generated · label generated · manifest generated
    ready to ship · invoiced · pickup generated · pickup scheduled
    pickup error · pickup rescheduled

Meanwhile these WERE being sent and fell straight through:

    OUT FOR PICKUP              44   the real first forwarding signal
    REACHED AT DESTINATION HUB  48
    PICKUP EXCEPTION            21
    UNDELIVERED                  9
    RTO IN TRANSIT               8
    UNTRACEABLE                  2
    RTO INITIATED / OFD / DELIVERED

**Any order whose first webhook was OUT FOR PICKUP never forwarded at all.**
44 events, and it was the earliest real signal.

The list is now built from observed data:

    new · out for pickup · pickup exception
    picked up · shipped · in transit · reached at destination hub
    out for delivery · delivered
    undelivered · untraceable
    rto initiated · rto in transit · rto ofd · rto delivered

**CANCELED** — 28 occurrences, American spelling — logs to admin without
forwarding. Both spellings guarded.

**Case can't be trusted:** Shiprocket sends both `DELIVERED` and `Delivered`
for the same event. Comparison is lowercased.

A test pins every observed status against the handler and asserts **100%
coverage by volume**. If Shiprocket adds one, that test fails rather than the
event vanishing.

# Shareable tracking links

    https://dotconnect-seven.vercel.app/tracking/TRKMT2MLYRK1058

Pre-fills the tracking ID and puts the cursor in the phone field, so a link
sent over WhatsApp is one tap and ten digits.

## The phone check is deliberately kept

Auto-loading from the URL alone would be more convenient. It would also expose
every consignment to anyone holding the link: consignee name, destination city,
item descriptions, quantities.

Tracking IDs are 18 characters and not guessable in bulk — but links get
forwarded, pasted into group chats, and indexed. The phone number is the one
thing proving the person opening it is the person the parcel belongs to.

**If you want the convenience instead**, it's one line in
`src/routes/tracking/[id]/+page.svelte` — say the word and I'll make the
change. I'd rather you chose it than inherit it.

The route redirects into the main form rather than duplicating the tracking UI,
so there's one set of error states, one rate limiter, and no second copy to
keep in step.

---

# Next

**Repoint Shiprocket's webhook** at the deployment:

    https://dotconnect-seven.vercel.app/api/webhooks/courier-updates-a

The 775 captured rows stop at 30 Aug 04:36 — they're arriving somewhere, almost
certainly the old carrier URL, which no longer exists. Those events are 404ing
and no order is being forwarded by them.

**Set the two webhook secrets** in Vercel and redeploy. Empty means the auth
check is skipped entirely, not that it fails.
