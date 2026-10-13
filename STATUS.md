# LOVE Andaman — Allotment v2 · Project Status

**As of:** 2026-09-19 · branch `lk-inbox` @ `§agFrame`
(a merge from GitHub landed at `6aa8cff`, bringing `§vanAssignScroll` from another session —
this work was re-tested on top of the merged tree, not on the pre-merge one)
(push from GitHub Desktop — the shell here has no credentials)
**Data snapshot:** `allotment_v2/data_exports/backup_2026-09-10_1830.json` (19.4 MB)
**Untracked, owner to decide:** `test/ui/t_scroll.mjs` + `test/ui/scroll_base.json` (real work from
another session — run it, then commit), `B2B-Promotion-Requirements.docx`, 5 scratch files in
`Claude outputs/`.

> Another Claude session landed **78 commits on 14–17 Sep** that this file does not detail: cost
> sheet, B2B promo, By-trip scroll/pin, mobile/iOS pass, sidebar theming, calendar, boat rental +
> fuel, petty cash, and `§testUI` (which moved the UI tests into `test/ui/`). Read
> `git log --oneline 898a866..HEAD` before assuming anything below is the whole picture.

---

## 1 · Where the project is

In production and in daily use across three piers. The app is past the build-it phase; the work now
is **correctness in the seams** — places where two screens disagree, or where something a person
typed doesn't reach the person who needs it.

### Scale it runs at

| | count |
|---|---|
| Bookings | **3,927** (3,589 confirmed · 297 cancelled · 24 weather · 9 rejected · 7 quote) |
| Trips | 3,931 · travel dates **2026-06-04 → 2027-05-14** |
| Agents | 795 |
| Contracts | 829 |
| Rate types | 51 |
| Invoices | 367 |
| Boats | 20 · Engines 53 · Maintenance records 112 |
| Routes | 57 |
| Guides 31 · Pier staff 40 · Pier job sheets 113 |
| Views (screens) | **68** |

### Development pace

| month | commits |
|---|---|
| 2026-06 | 27 |
| 2026-07 | 559 |
| 2026-08 | 430 |
| 2026-09 (to 14th) | 385 |

---

## 2 · What shipped most recently

All measured before and after, all with the regression suite green
(68 views · 21 value sets unchanged · registry clean).

### 2026-09-19 — the agent panel, split into framed sub-blocks

Asked for the detail inside each numbered band to be divided into smaller boxes. The first attempt
was clearer but **taller** — 1,978px flat → 2,140px boxed: a frame costs a border, a header and
padding, and the narrower columns pushed text onto second lines. The fix was not to drop the frames
but to cut the prose:

| | before | after |
|---|---|---|
| Alert row | "Contract v2025-1 ends 27 Sep 26 · renew before it lapses to keep pricing continuous" | `v2025-1 ends 27 Sep 26` |
| Contract ≠ rate | "The contract names RT - Main 26-27 TH-WW but the bound rate is T1 NYM · contract documents will…" | `contract RT-Mam 26-27 · bound Rt-NYM T1` |
| Whole panel | **1,978px** | **1,691px** |

Every explanation that got cut moved into a `title=` tooltip, so nothing was lost — it just stopped
taking vertical space on every view.

Two facts that were being told twice are now told once. The amber *Programs ไม่ตรงกับ Rate Type*
strip in block 4 said what the *Route with no price* alert in block 1 already says, so it is gone and
its **+ เติมที่ขาด** button moved onto the band header. The red *No rate type assigned* card was
duplicating the *Bound rate* box for the same reason.

The three summary values above the programs table (route count, contract window, earliest cutoff)
moved into the band's own header line, which removed a 60px strip without losing a number.

**Sub-blocks** (`§agFrame`): Commercial → Contract · Credit & payment · Booking channel. Rate → Bound
rate · In effect today · Contract & season · Sample prices. Company → Company · Contact · Sales owner
· Signatory · Contract template · Notes. A box whose subject needs attention tints its whole header —
Contract goes pink at ≤30 days, Signatory goes amber when unsigned — so the eye lands on the box that
matters before reading a single row.

The header bar is now `position:sticky` like the Dashboard's, which is what it should have been from
the start; it stays put next to the fixed sidebar. Not on phones, where it wraps to three rows and
pinning it would cost half the screen.

The contract-version pills were rebuilt for the box. The `.ct-history` component assumes a full-width
strip; inside a 280px box its text compressed into a vertical column.

### 2026-09-18 — checked "do new rate types overwrite each other?"

**They do not.** Creating three in a row, twice with the same name, leaves every existing rate in
place: ids come from `LA_UID` and `rtSaveDraft` re-rolls on any collision, and the auto-code appends
`-2`, `-3` when the base repeats. That path is now held by `test/ui/t_rtdup.mjs`.

**What the check did find, in the live data: five rate types share the code `RT-NANA`.** All five
were made on 22 Jul 2026 by the same salesperson, back when the code was typed by hand — codes have
been generated since 23 Jul and no duplicate has appeared after that date. Ids are unique, so nothing
was lost and nothing is mispriced today: `getRateType()` resolves by id everywhere.

It still matters, because **the agent Excel import matched a rate type by code and took the first
hit**. `SB_RATE_TYPES` is ordered by whatever Postgres returns, which is not guaranteed, so the same
file imported on two different days could bind agents to two different rates — silently. The five
`RT-NANA` rates are ฿1,700 to ฿2,600 for the same seat, and 101 agents hang off them.

Two fixes:

- `§rtImpCode` — the import resolves id → name → code, and each step must match **exactly one** rate.
  Anything ambiguous binds nothing and shows an amber note on that row of the preview ("Rate X matches
  3 rates · not bound"), with a count in the header. A value matching nothing is flagged too, instead
  of being dropped in silence.
- `§rtDupCode` — a red strip on Rate Types lists every duplicated code with the rates and how many
  agents each has, and a button renames the duplicates. The rate with the most agents keeps the
  original code (it is the one already written into import files and contracts); the rest get a fresh
  auto-code. It touches the code field only — not ids, not prices, not bindings, which the test
  asserts explicitly.

Proven to fail on three breaks: the import reverted to its old first-hit `find`, the fixer also
changing ids, and the duplicate scan not recognising a group.

### 2026-09-18 — picking a Rate Type now fills Programs in Contract

A rate type says which routes have a price. Programs in Contract says which routes the agent sells.
They describe the same thing from two directions, and until now both had to be typed separately —
so the second one was routinely skipped. That is where the 44 agents selling a route their own rate
cannot price came from: booking Save is blocked for them from the first day of the season.

**On changing an agent's rate type** (`§agProgFill`), the program list now follows:

- **adding is silent** — a route the rate can price but the contract does not list is simply added.
  Booking window = the agent's contract dates. Travel window = the rate's `routeValidity` for that
  route, which is what the Information tab was already overlaying at render time anyway.
- **removing always asks** — a route already in the contract that the new rate cannot price is only
  dropped if the person confirms. Cancel keeps it, and it stays visible as *Route with no price* in
  the agent's Needs-action block. Removing is deleting something Sales chose to put there.

Coverage is read from `seatRates`, not `rt.routes`: the declared list is what someone meant, the
price table is what the booking screen can actually charge.

A new agent created with a rate type gets its programs at creation, after the contract dates are
seeded (they are the booking window of every filled row).

**For the agents already in the system**, a panel on Rate Expiry (`§agProgBulk`) splits them in two,
because filling means different things to each:

| | agents | routes | what filling does |
|---|---|---|---|
| no programs at all | **204** | 1,090 | today they have *no* route restriction; filling gives them one — strictly narrower |
| partly filled | **51** | 58 | filling **widens** what they may sell, possibly past what Sales intended |
| route with no price | 44 | — | not touched here at all; per-agent confirmation only |

Programs are not a label — `§contract-scope` uses them as the whitelist of sellable routes at booking
Save. That is why the second group is a separate, amber button rather than part of the first.

`test/ui/t_agprog.mjs` (12 checks) computes coverage itself from `seatRates` instead of calling
`agProgPlan`. Proven to fail on four breaks: dropping without asking, travel window not taken from
`routeValidity`, the two bulk groups merged into one, and filling nothing.

### 2026-09-18 — the Agent List page, rebuilt around what needs doing

The page opened with four white KPI tiles: agent count, top market, credit-agent count, total credit
limit. Nothing on that row leads to an action. Meanwhile the things that do — a contract about to
lapse, an agent over their credit limit, a rate that expires with nothing set to take over, a route
the bound rate cannot price — were scattered across four separate banners and one small red dot on a
tab, and the tab row itself sat at the very bottom of the panel where nobody scrolls.

**The header is now the Dashboard's own bar** (`.dv-hd`), reused so the two pages people switch
between all day have the same furniture in the same places. The date block's slot holds the agent
count instead:

| | before | after |
|---|---|---|
| Header | 4 white KPI tiles + page title row, ~150px | one navy bar, **45px** |
| What it says | agent count · top market · credit agents · credit limit | **799 Agents / 305 selling now** · Credit 154 · ฿19.25M · **⚠ Needs action 166** |
| Buttons | page-actions row below the title | Card · Table · Excel form · Import · + New Agent, on the bar |
| Needs-action chip | — | opens a popover itemising it, same shape as the Dashboard's |

The red count deliberately excludes the 776 contracts ending 30 Sep: they end together on the annual
cycle, so folding them in would make the number 783 of 799 and mean nothing. They are listed at the
foot of the popover in grey instead.

**In the agent panel, the name now comes first and the tabs sit right under it.** The contract-version
pills that used to separate them moved into the Commercial block. The panel is five numbered bands:

1. **Needs action** — the four old banners merged into one strip, sorted by urgency, every row with a
   button that goes to the fix. Green single line when there is nothing. Built by `agAlerts()`, which
   is also what the strip counts, so the count and the rows can never disagree.
2. **Commercial** — contract, credit (with the utilisation bar), booking channel.
3. **Rate used for pricing** — bound rate · whether it is in its own window today · whether the
   contract names the same one · season schedule. Read from the bound rate, never the contract's.
4. **Programs sold** — unchanged table, now under its own band.
5. **Company & Contact** — company, sales owner, signatory, contract template, notes.

**Phone** (`§agPhone`): the 800-name list is collapsed behind a *Browse* button so the agent's data is
what opens; picking an agent collapses it again and scrolls to the name. The tab row scrolls
horizontally instead of wrapping to three lines; sheet rows put the label above the value; program
rows become one card per row. Checked at 375 / 390 / 430 — no horizontal overflow.

`test/ui/t_aghd.mjs` (18 checks) counts the agents itself from the raw data rather than calling the
page's own counter, so a wrong count is caught rather than agreed with. Proven to fail on eight
deliberate breaks: count off by one, selling-count doubled, a popover row's number shifted, tabs moved
back to the bottom, alert rows stripped of their buttons, the old contract banner restored, the phone
list left expanded, and the page title put back to `position:absolute` where it overlapped the chips.

### 2026-09-18 — the agent Information tab, rebuilt as a sheet

Everything on it was a rounded card with its own fill and border, stacked. Readable one card at a
time, impossible to compare down a column, and tall. The data is a table by nature — program ×
booking window × travel window — so it is now drawn as one.

**Done in CSS alone.** One `§agSheet` block appended to `01-base.css`; no HTML, no logic touched.
Deleting the block returns the page to cards exactly as it was.

| | before | after |
|---|---|---|
| Program row | 61px | **35px** |
| Program name + pier | two lines | one line |
| Rows | rounded cards with gaps | hairline-separated, no radius |
| Dates | proportional | tabular mono, columns line up |
| Sales person | 86px card | **42px** line |
| Info fields | filled rounded boxes | flat label/value, hairline below |
| Whole tab | 2,500px | **1,756px** |

The one piece of HTML that changed is the Rate-Type coverage banner, a ~75px box carrying one fact;
it is now a single line that wraps only when it is holding several route chips.

**A bug I introduced and caught in the same pass.** Putting each summary label beside its value made
the three-up strip wider, and that strip is flex, not grid — so the mobile rule in `02-skins.css`,
which only collapses grids, never touched it. At 390px the page overflowed by **88px**. Verified
against the pre-change build that this was mine, not pre-existing, then fixed by letting the strip
wrap and dropping its dividers under 820px.

`test/ui/t_aginfo.mjs` (9 checks, `npm run test:aginfo`) measures the rendered page rather than the
markup: row height, that name and pier share a line, that rows carry no card radius, that info
fields have no solid fill, that dates use a mono face, the sales line height, and no horizontal
overflow at 1400px **or at 390px**. Proven to fail: remove the whole block → `พัง 5`; remove just the
mobile wrap fix → `พัง 1`.

⚠ It must render inside `#view-agents` — the whole block is scoped under that id, and a probe that
renders elsewhere silently gets the old styling and reports the wrong thing. That cost a wrong
measurement before it was spotted.

**Merged tree, not the one this started on.** Partway through, `6aa8cff` merged `§vanAssignScroll`
from another session into `lk-inbox`, so `08-app.js` on disk was no longer the file this session
last wrote. The patch was applied to the merged base (hunks offset by 5 lines), every marker from
today's work was re-checked as present, and the whole suite was re-run against the merged tree:
`t_smoke` พัง 2 (environment-only), `t_mobile` · `t_aginfo` · `t_ratexp` · `t_rtseason` · `t_rtbulk` ·
`t_ratebind` · `t_ovnmeal` · `t_fleetcal` · `t_daydetail` all พัง 0.

### 2026-09-18 — rate management became a tab on the agent, not a corner of the price table

Correction on the previous round: the sidebar page was the wrong reading. What was wanted was a tab
on the agent, beside Activity, with the rate work taken out of Pricing Matrix entirely.

| Tag | Change |
|---|---|
| `§rtTab` | New agent tab **Rate Type**, after Activity, carrying all of it: the bound rate and its expiry, the season schedule, and a summary. A dot appears on the tab only when the rate is expiring with nothing set to follow it |
| `§rtTab` | The schedule editor is **in the page, not a modal**. A modal covers the thing being decided, which here is "which set applies on which date" — and that answer sits right below the editor, updating as rows change, before anything is saved |
| `§rtTab` | Pricing Matrix keeps one clickable line and nothing else to set. It starts the price table at **535px**, down from 733 two rounds ago |

**Two clicks for the common case.** When the contract already names the successor, the tab offers
*"เติมจากสัญญา · &lt;rate&gt; ตั้งแต่ &lt;date&gt;"* — it fills both ranges with the same split rule the bulk
tool uses, the summary below shows today on the old rate and the split date on the new one, and Save
commits. Nothing is guessed silently: the button only appears when the successor is active and the
split lands in the future.

**The popup editor was deleted, not left in place.** Two editors for one fact is how the two of them
drift apart until they disagree — the failure this file keeps recording. `rtSeasonOpen`,
`rtSeasonBlock` and `rtAgentRateStrip` are gone; a test asserts they stay gone.

The sidebar page is renamed **Rate Expiry**, since it answers a question the tab cannot: which of 202
agents need attention, and the bulk apply. Its how-to now points at the new tab.

`t_ratexp` grows to 27 checks: the tab exists, its editor is inline, the fill-from-contract button
appears and produces exactly two ranges, the summary is present, Pricing Matrix has nothing settable
left, and the popup functions are undefined. Proven to fail: remove the suggest button → `พัง 1`;
drop the pointer line from Pricing Matrix → `พัง 1`; cut the summary section → `พัง 1`.

Suite green: `t_smoke` พัง 2 (environment-only), `t_mobile` · `t_fleetcal` · `t_daydetail` ·
`t_ovnmeal` · `t_rtseason` · `t_rtbulk` · `t_ratebind` all พัง 0.

### 2026-09-18 — the warning and the schedule were crowding out the pages they sat on

Feedback after seeing the three previous pieces on real data: on production there are **11 rate
types and 202 agents** expiring, so the panel ran about **1,024px** and pushed the Rate Types list —
the reason that page exists — clean off the screen. On an agent, the expiry box plus the season block
added a second wall above the price table on a tab literally called Pricing Matrix.

| Tag | Change | Measured |
|---|---|---|
| `§rtAdmin` | New sidebar page **Rate Type Management**, holding the full panel. Rate Types keeps a one-line banner that carries the counts and links through | panel **1,024px → 39px** on Rate Types |
| `§rtStrip` | The agent's expiry box and season block merged into one strip, max two rows — status, what follows it, and the edit button. Detail lives on the new page | the price table now starts at **588px** instead of 733px |
| `§prList` | With zero promos, the per-route list printed one line per route to say "no promotion" — 12 lines saying the same thing. Collapsed to the header line; it expands as soon as a promo exists | part of the 733 → 588 |

The new page also carries **how to use it**, four numbered steps, because this is a twice-a-year job
nobody has done before: read the list, press the green button where the contract already names the
successor, set the rest by hand from the agent's Pricing Matrix, and watch rows disappear as they get
answered. With the reminder that setting a schedule is not the same as changing the rate, so it can
be done today rather than remembered on the 15th.

Three layout assertions added to `test/ui/t_ratexp.mjs` (now 19 checks): the Rate Types banner stays
under 80px and links onward, the full panel renders on the new page with its steps, and — measured
from what `agTabPrices` actually renders, not from calling the strip directly — the price table
starts within 680px of the top. Proven to fail: put the full panel back on Rate Types → `พัง 2`;
re-expand the empty promo list → `พัง 1`.

Suite green: `t_smoke` พัง 2 (environment-only), `t_mobile` · `t_fleetcal` · `t_daydetail` ·
`t_ovnmeal` · `t_rtseason` · `t_rtbulk` · `t_ratebind` all พัง 0.

### 2026-09-18 — filling 44 of those schedules from what the contracts already say

The schedule feature shipped with nobody using it and 26 days left. But the data needed to fill one
is already on file for most of them: current rate, successor named on the contract, and the date the
successor says it starts. That is a form, filled 44 times.

**It sets a schedule, it does not change the rate.** That distinction is the whole safety argument:
swapping the rate would move today's price while the low season is still running; a schedule leaves
every date before the split untouched and only changes travel dates from the split onward. So it can
be pressed today instead of remembered on the 15th.

**The split date needed two guards, and the first version had neither.** The naive rule — use the
successor's `validFrom` — produced **16 May 2026** for several groups, a date four months in the
past, because some rate types carry a `validFrom` from their own season rather than from where they
follow on. Applying that would have re-priced those agents immediately, the exact opposite of what
the dialog promises.

| Guard | Why |
|---|---|
| Split = successor's `validFrom` only when it is not earlier than the expiring rate's `validTo`, else the day after that `validTo` | Real data has both the clean hand-off (14 → 15 Oct) and a one-day overlap (15 → 15 Oct), plus the nonsense case above. This is contiguous by construction |
| Split must be later than today | Anything else moves a price that is already being quoted |
| Successor must not be `active: false` | One of the named successors is a disabled rate type |
| Agents who already have a schedule are skipped | Never overwrite something a person set by hand |

Measured on the 17 Sep data: **44 agents across 5 expiring rates**, in 4 successor groups, every
split 15 Oct 26. After applying all of them: **not one agent's price moves for today or for any date
before its split**, every one switches on the split date, and the warning panel drops **172 → 128**,
exactly the number set. Pressing again does nothing.

That last number found a second bug. The panel's "is this answered?" test was `season.from >
rate.validTo`, which misses the group whose new season starts on the same day the old rate expires —
151 agents. It now asks the precise question, "does any season cover the day after this rate ends",
and the count drops by exactly what was set rather than by 5.

`test/ui/t_rtbulk.mjs` (12 checks, `npm run test:rtbulk`) applies every plan for real and then
compares prices before and after, per agent, on three dates each. It also re-enables the disabled
past-dated successor on purpose to exercise the split rule with the `active` guard out of the way.
Proven to fail: allow disabled successors → `พัง 1`; overwrite hand-set schedules → `พัง 1`; revert
the panel's test to the old `>` form → `พัง 1`; remove **both** split guards → `พัง 1` (either one
alone still catches it — that is the point of having two).

Suite green: `t_smoke` พัง 2 (environment-only), `t_mobile` · `t_fleetcal` · `t_daydetail` ·
`t_ovnmeal` · `t_ratexp` · `t_ratebind` · `t_rtseason` all พัง 0.

**Still not pressed.** The button is on each panel row that has a named successor; nothing is applied
until someone reviews the dialog and confirms. The remaining 128 have no successor on file and need a
schedule set by hand.

### 2026-09-18 — a main rate that changes with the season, without a second priority ladder

The question that started it: SAYAMA's rate covers 16 May → 14 Oct — what prices a booking after
that? Answer was "the same one", and the ask was for several rates with priority 1/2/3.

**Priority was the wrong shape.** It already exists on Promotion, with its own tie-break. A second
priority ladder is two ladders that can disagree — the failure mode §5 of this file keeps warning
about. Seasons don't overlap, and priority exists only to resolve overlap. So: a **date-ranged list,
no priority**.

| | |
|---|---|
| Shape | `a.rateSeasons = [{rt, from, to}]` — sorted, non-overlapping, last one open-ended |
| Resolves per | **trip travel date, not booking.** One booking can cross the boundary — the island-hold leg that sails out on the 14th and back on the 15th is exactly that case, fixed earlier today |
| Not configured | byte-identical to before. Asserted across every agent × 6 dates — 2,946 points, 0 differences |
| No season covers a date | falls back to the agent's main rate, never null. `validTo` was deliberately not a gate for this same reason: the standard price must always exist |
| Promotion | unchanged, still overlays on top of whatever the season resolved to |
| Discount-mode promos | now discount from the season's main rate, not last season's — but only once a schedule exists; without one the old precedence is kept exactly |

Measured end to end through the real pricing path: SAYAMA, Whale Shark, 2 adults —
**14 Oct ฿6,200 → 15 Oct ฿6,400**, and a single booking holding both dates prices each trip from its
own rate set. Each trip now also stores `rtRef`, the rate that actually priced it, next to the
existing `promoId` stamp — a sold booking can say which set it came from without re-resolving.

The editor sits under the Source banner on the agent's Pricing Matrix, because that is where the
question gets asked. It validates rather than blocks — overlap, gaps, a closed last range, a
backwards range, a rate that no longer exists — since a schedule is always briefly wrong while being
typed. "จัดวันให้ต่อกันพอดี" snaps each range's end to the day before the next one starts, which is
the part people get wrong by hand.

**It closes the §rtExpiry loop**: an agent with a season starting after the current rate's expiry
drops out of the warning panel, per-agent line and count together. Set the schedule, the warning goes
away — measured 172 → 171 on one agent.

`test/ui/t_rtseason.mjs` (18 checks, `npm run test:rtseason`). Proven to fail: cut the season out of
the pricing path → `พัง 4`; return null instead of falling back → `พัง 2`; stop the sidecar carrying
the schedule → `พัง 1`; drop the `hasOwnProperty` guard so an old sidecar wipes a new schedule →
`พัง 1`; keep warning after a schedule exists → `พัง 1`. Suite green: `t_smoke` พัง 2
(environment-only), `t_mobile` · `t_fleetcal` · `t_daydetail` · `t_ovnmeal` · `t_ratexp` ·
`t_ratebind` all พัง 0.

**Nobody has a schedule yet.** The 172 exposed agents are still exposed until someone fills one in —
76 of them already name their successor on the contract, which the warning panel shows per row.

### 2026-09-18 — changing an agent's Rate Type from the Agents page was silently undone

Found while starting the season-schedule work, and it had to land first, because the season list
would have been eaten by the same mechanism.

The Agent→Rate Type binding is stored **twice**: `sb_agents[].rateTypeId` and a sidecar
`sb_agents_rate_bindings`. On load `_rtRestore` lets the sidecar overwrite the agent record. But the
two writers each wrote only one store — `rtPersist` (Rate Types page) the sidecar, `sbAgentsPersist`
(Agents page) the agent record.

So: change an agent's rate on the **Agents** page, save, reload — **the sidecar puts the old rate
back**, with no error and nothing on screen. Reproduced in the harness before fixing: set SAYAMA to
`RT - Main 26-27 TH-WW`, save, reload → back to `Special RATE Sayama LOW 2026`. Changes made on the
**Rate Types** page stuck, which is why the two stores had drifted for 32 agents in the same
direction and the effective prices still happened to be the intended ones.

| Tag | What was wrong | Measured result |
|---|---|---|
| `§rateBind` | Two stores, two writers, one store each. A rate change from the Agents page never reached the store that wins at load. | Both writers now write both stores. The same reproduction now keeps the new rate across reload. |
| `§rateBind` (guard) | `sbAgentsPersist()` is also called by seed blocks that run **before** `_rtRestore` in file order. Writing the sidecar there would push the stale `sb_agents` values over the newer sidecar — silently re-pricing every drifted agent. | `_LA_RATE_BIND_READY` opens only at the end of `_rtRestore`; before that the sidecar is left untouched. |

**The sidecar still wins at load, deliberately.** It has been there since the initial commit with no
recorded rationale, so it was kept rather than removed. That choice is what makes this safe: every
one of the 32 drifted agents keeps the exact rate the system was already using. **No price moves.**
Asserted in the test, not assumed.

Side effect worth having: `sb_agents[].rateTypeId` in an export is now true. Until today anything
reading it — a report, a script, a BI pull — got the wrong rate for those 32 agents. It got this
session's own first set of numbers wrong before the harness caught the disagreement.

`test/ui/t_ratebind.mjs` (7 checks, `npm run test:ratebind`) reloads the page twice and pins:
the Agents-page change survives, the Rate Types-page change lands in both stores, the guard refuses
to write the sidecar before the restore, and — the one that matters most — no already-drifted agent's
effective rate moves. Proven to fail: revert either writer → `พัง 1` each; remove the guard → `พัง 1`.
Suite green: `t_smoke` พัง 2 (environment-only), `t_mobile` · `t_fleetcal` · `t_daydetail` ·
`t_ovnmeal` · `t_ratexp` all พัง 0.

### 2026-09-18 — 172 agents are riding a rate that expires in 26 days, and nothing says so

Asked from the Agent screen: SAYAMA's rate covers 16 May → 14 Oct 26 — what gets used after that?

**The same one.** `validTo` is a label, not a gate; `§promoMx` says so deliberately, because the main
rate is the fallback that must always exist. The side effect is that the day it expires, pricing
carries on silently.

Measured on the 17 Sep backup, read the way the app reads it:

| | |
|---|---|
| Rate types expiring within 60 days, with agents on them | **12** |
| Agents riding them | **172** (biggest: `RT-MAIN TH-WW Low-Promotion`, 15 Oct, **151 agents**) |
| Of those, agents who sell a route their rate cannot price | **38** — Similan/Surin have no low-season price because the park is shut, so on the first day of the season the Save button locks (`noRate`) |
| Trips already booked to travel after 14 Oct on an expiring rate | **11** · 54 pax |
| Price drift where both rates price the route | Phi Phi Bamboo 1,700 → 1,800 · Whale Shark 3,000 → 3,200 — **undercharged by 100–200 ฿/pax**, silently |
| Promo contracts reaching past 14 Oct, system-wide | **1** — the promo overlay is not being used for the season change |
| Agents whose main contract names a *different* rate than the binding | **90**, of which **76** name `RT - Main 26-27 TH-WW` — the successor is already written down, just never applied |

SAYAMA shows the last row on one screen: the contract card reads `RT - Main 26-27 TH-WW`, the Source
line reads `MISHA-SPECIA-2 · Special RATE Sayama LOW 2026`. Pricing uses the agent binding; the card
shows the contract field. Two facts, one truth.

**`§rtExpiry` — a warning, and only a warning.** It does not touch pricing by one line. One reader,
two places that can never disagree: a panel at the top of Rate Types (every expiring set, soonest
first, agents on each, which routes will be blocked, and the successor the contract already names),
and one line in that agent's Pricing Matrix, right where the person is already reading the price.

**Found while measuring, worth its own line:** the Agent→Rate Type binding is stored **twice** —
`sb_agents[].rateTypeId` and a sidecar `sb_agents_rate_bindings`, and the sidecar overwrites the
agent record at load. They have drifted for **32 agents**. Anything reading the export's
`sb_agents[].rateTypeId` — a report, a BI pull, a script — gets the wrong rate for those 32. It read
wrong for me first, which is why the first numbers in this session were too high. The panel reads
in-memory `SB_AGENTS`, i.e. post-override, so it is correct; the export is not.

`test/ui/t_ratexp.mjs` (13 checks, `npm run test:ratexp`) pins the count against `SB_AGENTS`, pins
that the sidecar won, and pins the two rules this panel must never break: an expired rate still
prices, and an expired rate still appears. Proven to fail: make the panel read a different agent set
→ `พัง 1`; drop already-expired rates from the panel → `พัง 1`. Suite green: `t_smoke` พัง 2
(environment-only), `t_mobile` · `t_fleetcal` · `t_daydetail` · `t_ovnmeal` all พัง 0.

**Still open — the question that started this.** A rate list with priority 1/2/3 was asked for.
Priority already exists on Promotion, and a second priority ladder is two ladders that can disagree.
Agreed direction instead: **a season schedule on the main rate** — several rates, each with a date
range, non-overlapping, no priority, last one open-ended so a booking can never fall into a gap with
no price. Promotion keeps overlaying on top, untouched. Not built yet.

### 2026-09-18 — the OVN return day was being treated as a day at anchor

Reported from the floor: the kitchen popup surfaced an overnight pickup so its meal could be set,
pointed the user at the boat job sheet — and the job sheet had no meal field at all.

One idea was wrong in two places: **an OVN pickup was not counted as "this boat runs a route today".**

| Tag | What was wrong | Measured result |
|---|---|---|
| `§ovnRet` | `pjBoatSt` called any day where `hold.from !== date` a mid-span day. An island hold spans the day out **through the day back**, so the return day — when the boat actually sails home loaded — was classed "เหมาลำค้างเกาะ". `going` was false, so the whole `ครัว · ร้านอาหาร` block never rendered, and the card carried a false `⚠ โปรแกรมค้าง` with an `เอาออก` button beside a live trip. | Mid-span is now strictly between `from` and `to`. Oceanus, hold 16→18 Sep: 16 `run` · 17 `ovn` · **18 `run`**. Kitchen block present, false stale warning gone. |
| `§mealOvnRt` | The kitchen card read its route from `B.torder[0]`, but `§ovnCard` files pickup rows under `B.ovn` and never touches `torder`. A boat whose only job that day is the pickup got route `''` → no venue → no amount → **no send button at all**, under the message "ยังไม่ได้ตั้งร้านให้เส้นทางนี้" — while `r10` had ร้านอาหารต้นไทร set all along. | Falls back to the pickup rows' own `routeId`. Card now shows *Phi Phi Bamboo by Speedboat · ร้านอาหารต้นไทร 210/105*; pressing รวมอาหาร computes **฿2,520** (210 × 12). |

The Daily Log and Boat Status were already right — both gave Oceanus a full row on the 18th
(PAX 12, fuel, engine hours, water, เบิกของ). Only the boat job sheet and the kitchen card
disagreed, which is why the number looked recorded and the meal did not.

**Answering the question directly:** yes, the return day must be recordable. The boat is at sea,
carrying people who eat on the way in. A hold of *N* nights has *N+1* working days, not *N−1*.

`test/ui/t_ovnmeal.mjs` (13 checks, `npm run test:ovnmeal`) pins all of it — the per-day status
ladder, the route fallback, the ฿ figure, and the §mealOvn rule that the send button stays disabled
until every pickup is marked. Proven to fail: reverting `§ovnRet` gives `พัง 2`, reverting
`§mealOvnRt` gives `พัง 5`. Regression suite unchanged: `t_smoke` พัง 2 (environment-only, as
always), `t_mobile` · `t_fleetcal` · `t_daydetail` all พัง 0.

### 2026-09-17 — "what came in today", in one place

| Tag | What was wrong | Measured result |
|---|---|---|
| `§dayDetail` | The two Live bookings cards answer *"what arrived just now"* and nothing else. The list is the **12 most recent**, unfiltered by day and including cancellations; the summary strip above it counts **only that day's non-cancelled** bookings (`§liveAudit` says the two deliberately don't add up). Nobody could ask the dashboard *"what came in today, all of it, B2C vs B2B"* — that meant opening Booking and filtering by hand. | A popup off both cards. Both summary cards stay on screen together (that is the whole point of "แยก B2C/B2B" — a toggle would make the split unreadable); clicking one switches the breakdown below. Breakdown by route, by agent (B2C: by the channel the guest messaged in on), by travel month, by hour of arrival, by nationality. The list is **every booking of the day** — 17 Sep: **23 B2B rows** where the feed can show 12. |

Three reader rules, not four: `laIsB2C` (`§b2cOne`) splits the sides, `_dashBkDay`
(`§liveDay`) decides which day a booking belongs to, `acctBookingTotal` is the money. The popup
re-reads none of them raw — that is why its numbers cannot drift from the card's.
`laB2CChannel` is new and joins them: the channel lived in `b2cChannel` **or** in the `note`
line the website writes, and two readers of that would have been the next `§b2cOne`.

A second pass on the owner's feedback (`§dayDetail2`): the sheet is **full-screen** (a 14px
margin round a page that is open all day bought nothing and shortened the one long thing on it, the
booking list); **nationality moved to a card of its own**, so the breakdown row is four cards, all
four measured on the same ruler (ยอดขาย) so bar lengths compare across them; and the way in moved
off the card header — where it crowded the B2B/B2C pill onto a second line — down beside
"อัปเดตเองไม่ต้องรีเฟรช", which is already the card's line about the feed itself.

That pass also found a real bug the first one shipped: the popup header reused `.dv-kpi` from the
Dashboard's own header, whose narrow-screen rule is `width:100%` + `margin-right:-92px` — written
for a bar that has a floating button in its right corner. The popup has no such button, so at
390px the chips ran **82px past the right edge and took the close button off-screen with them —
no way out of the popup on a phone**. It threw no error, so `t_smoke` could not see it. Own class
(`.dv-ddkpi`), and `t_daydetail` now opens the popup at 390×812 and asserts 0px overflow with the
close button on screen.

A third pass added a **date range** (`§ddRange`): four presets (วันนี้ / 7 วัน / 30 วัน / เดือนนี้,
all anchored to the real today) plus two date inputs for anything they don't cover, and `‹ ›` now
steps by the whole window instead of by one day. The range lives in `_ddFrom`/`_ddTo`, deliberately
**not** in `_dashDate`: every card on the Dashboard behind it (seat calendar, Boat Operating,
Bookings/day) is a single-day view and could not render a range. A one-day range still drives
`_dashDate`, so the old behaviour — close the popup and the page is on the day you were looking at —
is unchanged; a real range leaves the page alone.

Two things the range forced:

- **A row cap.** 30 days of real intake is **1,194 bookings** (`2026-08-19 → 09-17`), and the B2B
  list alone is 1,085 rows. Measured: 300 rows repaint in **32–42 ms**, all 1,085 in **101 ms** — so
  the cap is for scroll weight, not for a stall. The list draws 300 and says so on the card, with a
  click to draw the rest; the summary numbers always count every booking in the range, never just
  the drawn rows.
- **The hour strip becomes a day strip** when the range is longer than a day. Hour-of-day summed
  over 30 days answers nothing; which days were heavy does.

It also surfaced a bug from the first pass: clicking a row called `dashOpenBooking`, which navigates
to Booking **behind** a full-screen overlay that never closed — the click looked like it did nothing.
Rows now close the sheet first, and the test asserts it.

### 2026-09-17 — `§b2cChan`, the channel card was reading voucher numbers as channels

The owner spotted rows in "ช่องทางที่ลูกค้าทักเข้ามา" named `LOV-1601617`, `LOV-6882506`,
`LOV-2168403` — one row each. `laB2CChannel`, written for `§dayDetail`, took the second segment of
the website's `note` line as the channel. That line has **two shapes**, and only the first has one:

```
B2C · Line OA · LOV-2892592 · Day Trip - Phi Phi - Maiton     ← channel present
B2C · LOV-2766863 · Day Trip - Phi Phi Island                 ← no channel; segment 2 is the voucher
```

**84 of 304** website bookings are the second shape, so the card grew **84 channels that are really
one booking each** — the four real channels were buried under a wall of voucher numbers. Segment 2
is now taken only when it is not that booking's own `voucherRef` (and does not look like a reference
code). Measured on live data: **84 distinct "channels" → 7**, and the untagged 84 land in one row.

They are labelled **ไม่ได้ระบุช่องทาง**, not "Website": they come from `b2c_sync` (23), `BD` (52)
and four named staff (9), so there is no single origin to infer, and a guess here would quietly
distort the number the owner reads to decide marketing spend. 84 of 367 B2C bookings with no channel
recorded is itself the finding.

`t_daydetail` now asserts the invariant that catches this whole class: **no booking's channel may
equal its own `voucherRef` or `id`**, plus a bound on the channel count. Reverting to the old parser
prints `พัง 2`.

`test/ui/t_daydetail.mjs` (`npm run test:daydetail`) recomputes the expected numbers from
`SB_BOOKINGS` inside the same page and compares them against what the popup renders. **Proven to
fail**: swap the day rule to `bookingDate` and it reports `พัง 4` — B2B drops 22 → 17 because five
of that day's bookings were keyed retroactively. Regression: `t_smoke` and `t_mobile` both print
exactly what they printed on `HEAD` before the change (2 environment-only failures each:
`contract-tmpl` 404, `pickupmap` needs network, `vancheckin` demo banner).

### 2026-09-17 — Fleet Calendar rebuilt around the question it is asked

| Tag | What was wrong | Measured result |
|---|---|---|
| `§fcMatrix` | The page laid a month out as *route → boats*, then appended a "Ready at pier" block per cell. It could not answer the question people actually bring to it — **"which boats are on this programme at this pier today, and what is still free there"** — without reading a whole cell. Worse, the 15 not-available boats were printed into **all 30 cells**, and their status does not change across the month; the only thing that varied was buried under a wall of repeated names. The four header counts didn't add up either: "TL 2 · VP 7 · RN 3" = 12 of 20 boats. | Rows are now **pier → programme**, columns are days, and a matrix view at **7 / 14 days** sits beside the month. Boats that are unavailable for the whole window collapse into one row per pier (14-day view: **1,136 px → 787 px**). Header counts reconcile: **TL 8 · VP 9 · RN 3 = 20**. |

A follow-up pass (`§fcEn`) dropped the page's own title block — the top bar already reads
**FLEET CALENDAR**, so the `<h1>` and its one-line description were a duplicate costing two full
rows; the view switcher moved into the top bar in their place. The same pass put **every string on
this page into English**: the owner's guests and partners read this screen, and it was the only
operations view mixing Thai labels into a table that foreign readers use. Code comments stay Thai —
their audience is whoever maintains the file, not whoever reads the screen. The two Thai strings
left on screen are boat names (`สบายดีทัวร์`, `เรือปลอม`), which are data, not labels.

`§fcFwd` changed where the matrix window starts. It had been centred on today (back 3 days for the
7-day view, back 6 for the 14-day), so half the table was days already sailed. This page is used to
plan forward — free capacity in the days ahead is the thing being looked for — so both windows now
begin on **today** and count forward; `‹` still goes back for anyone who wants the history.

`§fcPier` added the **pier filter chips** back (All piers / Tub Lamu / Visit Panwa / Ranong /
In Shop) — the rebuild had dropped them. Selecting one narrows the table *and* the three counters in
the top bar, so the header can never claim fleet-wide numbers over a single-pier table.

That same pass fixed a bug the owner caught **on a real iPhone, which no test here could have
seen**: the pinned first column did not stick, so scrolling sideways left rows of boat chips with no
label saying which programme they belonged to. Cause: `display:flex` on the sticky `<th>`. That takes
the cell out of table layout, and Safari then refuses to apply `position:sticky` — Chrome applies
both, so the dev machine looked perfect. The flex moved to an inner `<span>`. WebKit cannot be
downloaded in this sandbox, so `t_fleetcal` asserts the **condition** rather than the symptom: no
sticky `<th>` may compute to `display:flex`. Reintroducing the flex makes it report 9 offenders.

Two rules the rebuild had to settle, both written into the source:

- **Which pier a boat is at** now comes from `getBoatCurrentPier` — the same reader the Boat Status
  page groups by — not from the pier of whatever route it happens to run. That moved `Artemis`
  (registered at Tub Lamu, actually at Panwa) into Visit Panwa, and gave the 8 shop boats a group of
  their own instead of a footnote.
- **`§fcPax`, the number in each cell.** "People on the boat" (`bkBoatPaxOnBoat`, what Boat Operation
  uses) is **not** the same as "seats taken from the sellable pool" (`getAllotment`, what the
  Dashboard shows): 17 Sep Artemis reads **49** one way and **47** the other, because the second is a
  *route*-level figure that excludes charters. This page asks a *boat*-level question, so it uses the
  first — and the on-screen label says **"คนบนลำ / ที่รับได้"** so the two can never be confused.

`fcLoadMap` exists for speed: computing each cell with `bkBoatLoadOther` would be 14 days × 20 boats ×
every booking ≈ a million iterations per paint. It sweeps bookings once and `t_fleetcal` asserts the
result equals `bkBoatLoadOther` in **every** cell.

`test/ui/t_fleetcal.mjs` (`npm run test:fleetcal`) checks all 280 cells of a 14-day window against
their source readers, that no row header is a boat name (i.e. the table has not drifted back to
per-boat rows), and that at 390 px the table **scrolls** rather than being squeezed — the phone bug
this page shipped with in the mockup, where columns fell to 35 px and every label overlapped.
**Proven to fail**: swap the pier reader for `b.pier` and make `fcLoadMap` overwrite instead of
accumulate → `พัง 2` (140 wrong piers, 14 wrong loads). `t_smoke` and `t_mobile` print exactly what
they printed before.

### 2026-09-17 — vans on the guide sheet, and stale derived tables

| Tag | What was wrong | Measured result |
|---|---|---|
| `§gvanSplit` | A booking with a **split pickup** has its van moved out of `ops.vanId` and into `vanSplits`. The guide job order grouped on `r.vanId` alone, so every one of those bookings printed under **"มาเอง / เอเย่นต์ส่งเอง"** — the sheet told the guide nobody was collecting guests who in fact had a van. | `ckGroupVanId(r)` reads both shapes, applied at **4 grouping sites** (print sheet, screen cards, sheet-by-van, sheet-by-boat). Scan of the database: **6 of 6** bookings with `vanSplits` were affected, and all 6 span more than one van. |
| `§gvanJob` `§gvanJob2` | No way to open the guide job order from the boat band; `margin-left:auto` did not move the button because `.pcs-w` is `width:fit-content` + `position:sticky;left:0` on purpose. | Button sits **6 px from the visible pane's right edge** on both boats, via a full-width `.pcs-row` wrapper and `position:sticky;right:6px`. |
| `§gvanHead` `§gvanHead2` `§gvanHead3` | Van headers showed a short name only, and a booking split across two vans named just one of them. | Header is now `Love6 ทะเบียน 31-6678 · พี่คิง · 095-061-0687 / Love9 ทะเบียน 36-0024 · ต่อ · 098-448-4983` — same format on screen and on paper, both vans in full. |
| `§poKindStale` | Stock card headers printed raw ids (`pk_bo15o`, `pk_73f85`, `pk_0z9bq`). `PO_KIND` is a pre-built lookup; the sync path overwrote `PIER_KINDS` without rebuilding it. | Rebuild added to the sync path. **This turned out to be half the bug** — see the next row. |
| `§laDerived` | The audit that followed found the same fault on the **ordinary page load**: `PIER_KINDS`/`PIER_ITEMS` load around line 55000, but `poKindSync()` had already run at ~54970, so `PO_KIND` held only the three seed categories on **every F5**. And `RT_ADDON_DEFS` (built from `SB_ADDON_TYPES`) was never rebuilt on sync, so a custom add-on type created on another device never reached Rate Types or the contract text. | Cold boot: categories missing from the lookup **3 of 6 → 0**. The **ปรับยอด / ซ่อมเสร็จ buttons crashed on 7 of 21 items** (`PO_KIND[kind].u` on `undefined`) — **now 0 of 21**. `RT_ADDON_DEFS` picks up new types on sync. One function, `laRebuildDerived()`, called from exactly two places. |

**The detector is the reusable part.** Two datasets, the second with a `ZZMARK` item added to every
registry; boot one page fresh and drive `_laReloadData` on another; diff which globals contain the
marker. What the fresh page has and the reloaded page doesn't **is** the stale-table list, with no
code reading involved. It found `RT_ADDON_DEFS` on its own. Rebuild it when you touch the load path
(the recipe is in `HANDOFF.md` §5).

### 2026-09-14 — data integrity, the seams

| Tag | What was wrong | Measured result |
|---|---|---|
| `§chOpsSync` | Changing the boat on a charter booking updated the sales record and the fleet lock but **not** `ops.boatId` — the field Boat Operation, pier check-in, job sheets and the Daily Fleet Log all read. The manifest showed the new boat; every operational screen still sent crew to the old one. | Edit→Save now leaves all four in agreement. Already-broken bookings self-repair on the next manifest render. |
| `§ovnBoatFollow` | Overnight bookings have a system-generated return leg. It was converted to charter **once** and never updated, so changing the outbound boat left the return leg on the old one — **two whole boats locked for one 12-pax group** on the return date. | Return leg follows the outbound. Old boat released across the whole span (16–19 Sep: `Oceanus` only, was `Zeus + Oceanus`). |
| `§bkAlFlush` `§bkAlFree` `§bkAlKeep` | Text typed into the allergy box and saved without pressing "+ เพิ่ม" was **silently discarded**. The free-text food field had no input anywhere in the booking form. `pierAt`/`pierBy` were wiped on every save. | Pending text is captured on save (long → note, short → counted chip). New "รายละเอียดเพิ่มเติมเรื่องอาหาร" field. Pier attribution survives. |
| `§gdAlList` `§pckAlTip` | The guide job sheet read only the free-text allergy field, **never `allergyList`** — but chips are the primary way allergies are recorded (every preset button creates one). Allergies entered the normal way never reached the guide. Pier check-in showed a count with no detail and no tooltip. | Guide sheet prints both forms (verified on a real 22 KB sheet). Pier chips carry the detail in a tooltip. |
| `§drIssIdle` `§drIssMerge` | Non-departing boats had their whole row collapsed, so supplies loaded onto a parked boat had to go into free "อื่นๆ" rows — which are **not counted in the column totals**. Visit Panwa 8 Sep: blue Pepsi read 8, actual 11. | All 9 boats keyable (was 2/9). Duplicate "อื่นๆ" rows now flagged and one click merges them into the column. |

### Printed documents

| Tag | Result |
|---|---|
| `§pjWkLb` | Custom slot names on non-departing boats now print (they were stored under a separate key the sheet never read). |
| `§pjHideIdle` | Idle boats hidden by default on screen; the "Not available" box collapses to a one-line count on paper (941 → 75 chars), which also gave the Departures box back its width — programme names stopped truncating. |
| `§pjLbScope` `§pjGdOrder` `§gdOptOrder` | Slot names are per-boat-per-date, print on the sheet, and guide rows follow card order instead of Thai alphabetical. |

### UI

| Tag | Result |
|---|---|
| `§laRfLeft` | "มีข้อมูลใหม่" banner moved to the bottom-left, sized exactly to the sidebar column (250 px, 0 px overflow into content). It used to cover the page action buttons. Small screens unaffected. |
| `§abRisk5` `§abBar14` `§abTop20` `§abAgPill` `§abRowH` `§abGrid2` `§abSB3` | Action Board pass: at-risk threshold, 14-day bars, top-20 agents, agent colour bands, aligned rows, 3 px scrollbars. |

---

## 3 · Verified correct — do not re-audit

Checked by measurement this cycle; no change needed:

- **ใบแจ้งร้านอาหาร (kitchen order slip)** — reads all three food sources (tick-box counts,
  structured allergy chips, free text). Printed and confirmed. This was the one document that had
  been right all along; the code comment says so explicitly.
- **Charter TRIPS release on save** — the edit path correctly releases the old boat's lock before
  applying the new one. The bug was only in `ops.boatId`, now fixed.
- **Every other pre-built lookup on the load path** — the `ZZMARK` detector, re-run after
  `§laDerived`, leaves exactly two hits, both harmless: `SB_AGENT_PRICES` (the v1 pricing table;
  **0 of 3,734 bookings** are schemaVer 1, so the path is dead) and `_loaded` (a boot temp read only
  by the three lines under it).

Not checked, by the owner's decision: **ใบยื่นเจ้าท่า** and **ใบสั่งงานมัคคุเทศก์** (whether food
detail appears on them).

---

## 4 · Open items

### High — customer safety, needs a person

**30 bookings where the agent voucher records a food request but the system has no detail.**
Full list: `Claude outputs/food_notes_missing_2026-09-14.md`. Among them:

```
1pax allergic to shellfish          Allergy shellfish
Cashew nut allergies                1pax allergic with alster and almond
Allergy papaya                      Allergies strawberry, oat, kiwi, coconut
1pax allergy with eggs              Dairy and no cheese
No seafood                          several "Halal food" with halal count = 0
```

The text is recoverable — it sits in the voucher OCR already attached to each booking. A script
could restore it automatically, but it **should not run unattended**: these are allergy records and
a mis-parse is a health risk. Recommendation: work the list by travel date, future dates first,
with a human confirming each line.

Root cause is fixed as of `f0eba63`, so the list should stop growing.

### Medium — data hygiene

- **86 active MAIN contracts point at a different rate type than their agent.** Breakdown of the
  829 contracts: 498 agree · 209 have no rate type on the contract while the agent has one
  (cosmetic — the contract card shows nothing) · **86 genuinely disagree** · 13 belong to agents
  that no longer exist · 1 reversed. `§ctRateSync` keeps new changes in step; these 86 predate it
  and need a one-shot repair pass that the owner reviews.
- **3 trips have a display-string date** (`"Sat Jul 04"`) instead of `YYYY-MM-DD`. All three are
  cancelled B2C test records (`b2c_BK-001..003`). Harmless today; worth deleting or normalising
  before the relational migration, which will reject them.

### Low / offered, not requested

- Crew + guide block on ใบงานไกด์ with custom slot labels (it is an internal document, so the
  constraint that blocks it on the park register doesn't apply).
- Pier "โน้ต" text does not reach the kitchen slip — only the "อาหารพิเศษ" dialog does. Believed
  intentional; confirm with the pier team before changing.
- `_to_delete/gitlocks/` and `_to_delete/abase/` are scratch and can be deleted by the owner
  (the session cannot delete files on the mount).

---

## 5 · Risks worth naming

| Risk | Why it matters | Mitigation in place |
|---|---|---|
| **Fields lost on booking save** | `bookingV2CommitBooking` rebuilds the record from the form; anything the form doesn't render can be dropped. This one pattern caused three separate incidents (`ops.boatId`, `pierAt/pierBy`, the food note). | Each found instance fixed. **No systematic guard exists.** A diff-on-save audit — snapshot before, compare after, log dropped keys — would turn a whole bug class into a log line. Recommended next piece of work. |
| **Same fact stored in two places** | Charter boat lived in `charterBoatId` *and* `ops.boatId`; allergies live in `allergyList` *and* `allergies`; slot labels lived globally *and* per-boat; a van lives in `ops.vanId` *or* inside `vanSplits`. Every one of these produced a bug where two screens disagreed. | Fixed case by case. The general fix is a single reader per fact (`bkBoatIdOf`, `bookingV2AllergyText`, `ckGroupVanId` are the good examples) — **use them, don't re-read the raw fields.** |
| **Pre-built lookups going stale** | `PO_KIND` and `RT_ADDON_DEFS` are assembled once from raw arrays that two different paths overwrite. Both went stale; one of them crashed a third of the stock-item buttons for months. | **Closed as a class.** `laRebuildDerived()` (`§laDerived`) is the single rebuild, called from the end of `_laReloadData` and the end of `08-app.js`. **Add any new pre-built lookup to that one function.** The `ZZMARK` detector re-runs in minutes and proves there are no others. |
| **No automated test gate** | The regression suite is real and effective, but it is run by hand from a scratch directory. A new contributor would not know it exists. | `HANDOFF.md` §5. Moving `/tmp/w` into the repo and wiring CI is the obvious upgrade. |
| **Single 63k-line file** | `08-app.js` holds booking, pricing, pier, vans, accounting and printing. Changes are safe only because of the `§tag` comments and the patch-with-assert discipline. | Do **not** attempt a modularisation; 2,218 inline handlers depend on the global scope. Treat the tags as the module boundary instead. |
| **Backup cadence** | The newest export is the only way to inspect live data from outside the app. On 2026-09-14 the gap was 3 days and a reported booking simply wasn't there yet. | Ask for a fresh export before investigating anything recent. |

---

## 6 · Suggested next actions, in order

1. **Work the 30 food-note bookings**, future travel dates first. Highest real-world consequence
   of anything on this list.
2. **Build the save-diff audit** for `bookingV2CommitBooking`. It closes the bug class that produced
   three of this cycle's incidents rather than the fourth instance of it.
3. **Repair the 86 stale contract rate types** with a reviewed one-shot pass.
4. **Move the test harness into the repo** and run `t_smoke` + `t_vals` in CI. `§testUI` has already
   started this (`test/ui/`); finish it, and bring the `ZZMARK` stale-table detector along — it is
   cheap to run and it caught a live crash.
5. Decide on ใบยื่นเจ้าท่า / ใบสั่งงานมัคคุเทศก์ food coverage (deferred, not closed).
6. Two offers left unanswered on 17 Sep: whether the printed guide sheet should split a multi-van
   booking into **one row per van** (a larger change than the header fix), and whether the on-screen
   van header needs the second van's full details too.
7. Offered with `§dayDetail`, not requested: split the day's intake by pier/boat, a search box in
   the list, an Excel export of the day.

---

## 7 · Where to read next

| Question | File |
|---|---|
| How do I work on this without breaking it? | `HANDOFF.md` |
| How does it run / deploy / authenticate? | `README.md` |
| How is it put together? | `ARCHITECTURE.md` → `allotment_v2/docs/workflows/README.md` |
| Why is this odd block written this way? | `grep '§tagname' allotment_v2/js/` — the comment above it |
| What was asked for and not built? | `BACKLOG.md` |
