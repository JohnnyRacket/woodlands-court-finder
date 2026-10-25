# Court data reconciliation: Township GIS ↔ ActiveNet ↔ website

*Generated from Woodlands Court Finder's automated sync, October 2026. Every finding below is re-checked on each run and listed live on the app's `/status` page.*

Woodlands Court Finder joins three Township systems that were never designed to talk to each other:

| System | What it knows | Key it uses |
|---|---|---|
| ArcGIS (`SPORTS_COURTS` layer, 85 tennis/pickleball features) | Where courts are, type, lighting | `ID` (e.g. `TNS01-ALB`), `PARKNAME`, `COURTID` |
| ActiveNet (99 reservable courts, 171 tennis/pickleball programs) | Reservations, programs | Resource ID (e.g. `1089`), free-text names and locations |
| thewoodlandsparks.com pickleball page | Drop-in times, tournaments | Prose only |

They share no common key. The app links them with fixed, tested rules (park name normalization + court number), which works for every court today but breaks whenever a name is edited in one system.

## Findings

| # | Finding | Evidence | Impact | Suggested fix |
|---|---|---|---|---|
| 1 | **19 dedicated pickleball courts are missing from GIS** | Creekwood Pickleball 1–5, Falconwing Pickleball 1–8, Windvale Pickleball 1–6 exist in ActiveNet (resources 1029–1036, 1089–1093, 1112–1117) but have no `SPORTS_COURTS` feature | Any GIS map, dashboard or Experience Builder app undercounts pickleball by 19 courts; lighting is unknown for them | Digitize the three court sets (`COURT_TYPE = 'Pickleball'`, `LIGHTED`, `AMENITYID`) |
| 2 | **5 GIS pickleball courts aren't reservable online** | `PKL01-BBR` … `PKL05-BBR` (Bear Branch) have no ActiveNet resource, yet 9 programs are held at "Bear Branch Multi-Use Court" | Residents can't tell whether the multi-use court is first-come or program-only | Confirm the intended policy; if reservable, add ActiveNet resources; if not, say so on the park page |
| 3 | **Duplicate GIS asset ID** | Both Harper's Landing courts have `ID = PKTN01-HRL` (court 1 and court 2) | Breaks any join, work order or inspection keyed on `ID` | Rename court 2 to `PKTN02-HRL` |
| 4 | **Program title contradicts its schedule** | ActiveNet program 74372 "Fall 2026 Pickleball Drop In - **Saturdays** - Dave" is scheduled **Mon–Thu 8:30–10 a.m.** (same slot as Pickleball 101/102) | Residents looking for Saturday play find nothing; weekday courts are held | Correct the pattern or the title (likely a copied pattern) |
| 5 | **Drop-in play shows as "booked"** | On Mon Oct 26, all 8 Falconwing courts are booked 8–10 a.m. and 5–9 p.m., exactly the published drop-in windows, with no event name in ActiveNet | ActiveNet tells residents courts are reserved while open play is running; only the website prose says otherwise | Name the blocking reservations (e.g. "Drop-in play: open to all") or enable ActiveNet's public online calendar (the API currently returns "No license") |
| 6 | **Program locations are free text** | 145 of 171 programs map to a park, but courts are embedded in text ("Bear Branch Tennis Courts #9, 10 & 11", "Shadowbend 3 -5", "Cattail court 2"); 26 use "TBD", "Various…" or non-court venues | Can't tell which courts a program holds; the app labels the park, not the exact court | Book program facilities as ActiveNet facility reservations linked to the activity |
| 7 | **No shared key between GIS and ActiveNet** | ActiveNet names differ from GIS: "Coppersage Tennis 1" vs `COPPER SAGE PARK`, "WendtwoodsTennis 1", "Timarron Tennis Court #1" | Every integration has to re-invent name matching | Add an `ACTIVENET_ID` field to `SPORTS_COURTS` (or the GIS `ID` as an ActiveNet custom field) |

## How this was produced

- **Automated:** the `courts` source fetches GIS and ActiveNet daily, matches by park + court number, and records every unmatched or inconsistent record as a note. The `activenet-programs` source flags titles that name a weekday the program never meets on.
- **Read-only, public data:** no logins, no bookings; requests are spaced and scheduled to stay polite to Township systems.
- **Repeatable:** findings disappear from `/status` on their own once fixed upstream.
