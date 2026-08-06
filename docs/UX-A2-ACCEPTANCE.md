# UX-A2 owner acceptance

Status: **passed on physical iPhone Safari on 6 August 2026**.

This record supersedes earlier current-status wording that described UX-A2 device acceptance as pending.

## Accepted behaviour

Pritesh confirmed that Player Detail:

- locks the background page while open;
- scrolls internally to the final content;
- keeps the close control reachable;
- works in portrait and landscape;
- restores the exact underlying page position on a normal close;
- starts at the top when reopened;
- closes correctly from the backdrop.

The first portrait → landscape → portrait cycle exposed Safari automatically enlarging the text. The production correction fixes root text adjustment at 100% using both the WebKit and standards properties. Pritesh repeated the corrected rotation check and confirmed it worked perfectly, with scrolling and closing still intact.

## Separate future proposal

The owner also raised whether Player Detail contains too much information and requires excessive scrolling. That is a separate information-density and hierarchy review. It is deliberately excluded from UX-A2 and requires its own investigation and explicit approval.

## Boundaries retained

No Player Detail data, projection, expected-minutes, scoring, fixture, squad, captaincy, simulation, transfer, rank, Mini-League, provider, persistence, authentication, Cloudflare or security behaviour changed.