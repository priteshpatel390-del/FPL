# Leagues Hub-First Design

Status: owner-approved implementation scope, 7 August 2026.

## Outcome

`#/leagues` is the user's all-league hub. It lists every classic league attached to the connected Official FPL entry, grouped into invitational and general leagues when Official FPL supplies the league type. A separately saved league that is not present in the connected entry remains visible under Saved leagues.

Each row shows the league name and the user's Official FPL membership position/movement when a positive published rank exists. Rank `0`, null or otherwise unpublished values are never presented as a real position; pre-season uses **Not ranked yet**.

Tapping a league stores the existing selected league choice and opens the ID-free `#/leagues/detail` overview. Existing `#/leagues/standings`, `#/leagues/rival` and `#/leagues/exposure` remain deeper selected-league destinations. `#/leagues/manage` remains a secondary control from the hub.

The Manage Leagues surface distinguishes connected Official FPL memberships from manually added league IDs. Connected Official FPL leagues remain selectable and may be made primary, but they do not expose a misleading local **Remove** action because discovery would add them back on the next Official FPL entry refresh. A league that is confirmed absent from the connected entry is labelled **Added manually** and may be removed. If the connected entry is temporarily unavailable, provenance is labelled conservatively as **Saved league** and removal is withheld until membership can be verified.

## Data and performance boundary

The hub uses only the already-loaded Official FPL entry/classic-league membership facts and locally saved league choices. Opening `#/leagues` does **not** fetch standings for every league. Standings requests begin only after a user opens a specific league or one of its deeper selected-league routes. Large-league targeted pagination and on-demand rival squad loading remain unchanged.

## Exclusions

No provider, endpoint, authentication, rank projection, effective ownership, rival score prediction, strategy model, transfer logic, squad logic, fixture logic or projection formula changes are included. No league or manager identifier is added to the URL.

## Acceptance

Automated coverage must prove the hub/detail route hierarchy, grouped league membership rows, rank/movement presentation, full-row keyboard/touch semantics, no standings fetch on the hub, Official-vs-manual Manage Leagues provenance/removal semantics, existing targeted pagination and no-strategy/model guards. Physical iPhone Safari acceptance remains required for the new hub, selected-league transition and Manage Leagues presentation before the Leagues pre-season checkpoint can close.
