# TEAMSHEET2-ITEM1-IPHONE-REVIEW.md — Physical iPhone review follow-up

Status: **Owner findings recorded 31 July 2026. Interface corrections approved for implementation; data/security items remain investigation only.**

## Physical evidence

Pritesh opened the first-party GitHub Pages preview from an iPhone Home Screen installation and reviewed every static route. This produced direct evidence of inconsistent dock positioning, emoji/icon mismatch, visible route-heading focus rings, duplicated Settings hierarchy and an over-prominent diagnostic header. Populated Team, Transfers, Fixtures, Player Explorer and Leagues behaviour could not be accepted because Official FPL data did not load in the preview.

## Approved interface corrections

- Data and Evidence are removed from the global header; their complete detail remains under Settings.
- Every route receives one compact Ask Teamsheet text field with an internal claret upward-arrow send control.
- Ask draft text persists while moving through routes because the composer is one persistent shell element.
- Sending carries the question into the full Ask route and provides an accessible return arrow to the originating route.
- The bottom navigation is one fixed five-column safe-area dock with controlled monochrome SVG icons.
- The dock is hidden while the iPhone software keyboard materially reduces the visual viewport, then restored when the viewport returns.
- Route headings retain programmatic focus for assistive technology while non-interactive headings suppress Safari's visible focus outline.
- Settings subsections use one accessible claret back arrow, without repeated red or grey Settings labels.

## Investigation only — no implementation authority

### Foreground refresh

Existing behaviour deliberately blocks decision controls while a complete approved-provider cycle settles, preventing a visible mixture of old and new verified state. Physical review shows that repeated foreground returns make the app feel frozen. The proposed direction is a separately approved double-buffer/stale-while-revalidate design: keep the last complete verified state interactive, build the next complete state off-screen, then swap atomically. This changes the Stage 10.1 trust boundary and is not implemented in this patch.

### First-party preview data failure

The preview reached explicit restricted mode after Official FPL relay requests failed or timed out. The static GitHub Pages app still depends on public CORS relays whose recorded availability is medium. A populated acceptance run requires a reliable first-party transport design—most likely the already-deferred same-origin serverless proxy—but no provider, endpoint, relay or CSP change is authorised here.

### Bank and free transfers

The owner requires both values to be read-only and authoritative from the connected FPL account. The current application retains manual fields. The repository has not yet proven a public Official FPL response that reliably supplies the manager's current available free transfers and bank without authentication or inference. No guessed or derived value may be labelled authoritative. Endpoint, authentication, privacy, fallback and transfer-planner consequences require a separate proposal and approval.

## Remaining acceptance gate

The corrected preview must be reviewed again on the physical iPhone. Full 2.0.1 acceptance also remains blocked until a populated first-party preview permits review of the squad, player, transfer, fixture and league surfaces.
