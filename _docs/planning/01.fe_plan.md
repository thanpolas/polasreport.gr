# Fuel Price Visualization — Full Spec

## Context

polasreport.gr is a Greek political analysis site (Jekyll, GitHub Pages) that currently has zero JS frameworks. We've built a data pipeline that collects daily Greek fuel pump prices (from PDF bulletins) and Brent crude oil prices (from FRED). Now we need a frontend to visualize the daily % change comparison — revealing whether refineries profit from volatility ("rockets and feathers" effect).

This page will become a **landmark public utility** — a usable alternative to the ministry's unusable fuelprices.gr. The information architecture prioritizes what citizens actually need: today's price, whether it's high or low, and then progressively deeper analysis.

---

## Page Information Architecture

The page follows a **progressive disclosure** pattern — most useful first, deeper analysis as you scroll.

```
┌─────────────────────────────────────────────────────┐
│  SECTION 1: TODAY'S PRICES (hero, above the fold)   │
│                                                     │
│  ┌─────────────────────────────────────────┐        │
│  │         ΑΜΟΛΥΒΔΗ 95                     │        │
│  │         €1,924                          │        │
│  │     ▲ +4.2% vs μέσος όρος έτους        │        │
│  │                                         │        │
│  │  [  GREEN / AMBER / RED background  ]   │        │
│  └─────────────────────────────────────────┘        │
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Diesel   │ │ Αμόλ.100 │ │ Autogas  │            │
│  │ €1,902   │ │ €2,115   │ │ €1,218   │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│                                                     │
│  Τελευταία ενημέρωση: 16/03/2026                    │
├─────────────────────────────────────────────────────┤
│  SECTION 2: PRICE HISTORY                           │
│                                                     │
│  ┌─────────────────────────────────────────┐        │
│  │  Chart: Unleaded 95 price over time     │        │
│  │  [1M] [3M] [6M] [1Y] [All]             │        │
│  │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~       │        │
│  └─────────────────────────────────────────┘        │
│                                                     │
│  ┌─────────────────────────────────────────┐        │
│  │  Chart: Brent crude price over time     │        │
│  │  [1M] [3M] [6M] [1Y] [All]             │        │
│  │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~       │        │
│  └─────────────────────────────────────────┘        │
│                                                     │
│  (desktop: side by side / mobile: stacked)          │
├─────────────────────────────────────────────────────┤
│  SECTION 3: THE ANALYSIS                            │
│                                                     │
│  Explanatory copy: what is the rockets & feathers   │
│  effect, what we're measuring, why it matters       │
│                                                     │
│  ┌─────────────────────────────────────────┐        │
│  │  Chart: Cumulative spread               │        │
│  │  (pump % change − crude % change)       │        │
│  │  "The smoking gun"                      │        │
│  │  [1M] [3M] [6M] [1Y] [All]             │        │
│  │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~       │        │
│  └─────────────────────────────────────────┘        │
│                                                     │
│  ┌─────────────────────────────────────────┐        │
│  │  Chart: Daily % change overlay          │        │
│  │  Brent vs Unleaded 95                   │        │
│  │  [1M] [3M] [6M] [1Y] [All]             │        │
│  │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~       │        │
│  └─────────────────────────────────────────┘        │
├─────────────────────────────────────────────────────┤
│  SECTION 4: OPEN DATA                               │
│                                                     │
│  "Κατεβάστε τα δεδομένα"                            │
│                                                     │
│  📥 Τιμές καυσίμων (CSV)                            │
│  📥 Τιμές καυσίμων (JSON)                           │
│  📥 Τιμές Brent crude (CSV)                         │
│  📥 Ενοποιημένα δεδομένα (JSON)                     │
│                                                     │
│  Methodology note + data source attribution         │
└─────────────────────────────────────────────────────┘
```

---

## Section 1: Today's Prices — Detailed Spec

### Hero Price Card (Unleaded 95)

The primary card is large and dominant — it's what 90% of visitors come for.

**Content:**
- Fuel type label: "Αμόλυβδη 95"
- Price: "€1,924" (large, bold, the biggest text on the page)
- Comparison line: "▲ +4.2% πάνω από τον μέσο όρο έτους" or "▼ −2.1% κάτω..."
- Subtext: 365-day rolling average shown as reference (e.g., "Μέσος όρος: €1,846")

**Color coding — background tint based on percentile position within the 365-day range:**

| Condition | Color | Meaning |
|---|---|---|
| Below 365-day average | Green (`#2a9d8f`) | Cheap relative to recent history |
| 0–10% above average | Amber/Yellow (`#e9c46a`) | Normal/slightly elevated |
| >10% above average | Red (`#e63946`) | Expensive relative to recent history |

Why percentile vs standard deviation: percentile is intuitive for non-technical users. "More expensive than 80% of days this year" is immediately understood. Standard deviation is not.

The thresholds are deliberately simple — the goal is a gut-level signal, not precision. The exact percentage is shown in text for those who want it.

**Visual treatment:**
- Rounded corners, subtle shadow (`$shadow-md`)
- Background color is a soft tint (10-15% opacity), not a full saturated block — keeps text readable
- Price in large display type (~3rem desktop, ~2.25rem mobile)
- The arrow (▲/▼) is colored to match the background intent

### Secondary Price Cards

Three smaller cards in a row (flex, wrapping to stack on mobile):

| Card | Label | Notes |
|---|---|---|
| Diesel κίνησης | Most cars' second option | Same color logic as hero |
| Αμόλυβδη 100 | Premium fuel | Same color logic |
| Autogas (LPG) | Niche but growing | Same color logic |

Each card shows:
- Fuel type label
- Price (smaller than hero, ~1.5rem)
- % vs 365-day average (small text)
- Color-coded background tint (same logic as hero)

**Heating diesel** is seasonal — only show it October through April. Hide it in summer months. When visible, it becomes a 4th card.

### Update timestamp

Below the cards: "Τελευταία ενημέρωση: 16 Μαρτίου 2026" — plain text, muted color, small.

---

## Section 2: Price History — Detailed Spec

### Chart A: Unleaded 95 Historical Price

**What it shows:** Absolute price (EUR/liter) over time. Single line.

**Purpose:** "Has fuel gotten more expensive?" — the simplest, most common question.

**Chart config:**
- Y-axis: EUR/liter (left), starting from a reasonable floor (not zero — that would compress the visual). Auto-scaled with some padding.
- X-axis: Dates
- Single series: Unleaded 95, colored `#e63946` (red — matches the "fuel" brand)
- Horizontal reference line: 365-day rolling average, dashed, muted gray
- Area fill below the line at ~8% opacity for visual weight

### Chart B: Brent Crude Historical Price

**What it shows:** Brent crude closing price (USD/barrel) over time. Single line.

**Purpose:** Context — "what is the raw material doing?"

**Chart config:**
- Y-axis: USD/barrel (left)
- Single series: Brent crude, colored `#2a9d8f` (teal — distinct from fuel red)
- Same reference line treatment (365-day average)
- Area fill below

### Desktop vs Mobile Layout

- **Desktop (>720px):** Two charts side by side, each 50% width (minus gap). They share the same X-axis timeframe so visual comparison is natural.
- **Mobile (<720px):** Stacked vertically, full width. Fuel chart first, Brent below.

### Note on units

A brief note between/below the charts: "Σημείωση: Οι τιμές καυσίμων είναι σε EUR/λίτρο. Το Brent crude σε USD/βαρέλι. Η σύγκριση γίνεται μέσω ημερήσιων ποσοστιαίων μεταβολών (%)."

---

## Section 3: The Analysis — Detailed Spec

### Introductory Copy

Before the charts, 2-3 short paragraphs explaining:

1. What "rockets and feathers" means — when crude rises, pump prices shoot up fast (rocket). When crude falls, pump prices drift down slowly (feather). This asymmetry means refineries/distributors systematically capture extra margin during volatile periods.

2. How we measure it — we compare the daily percentage change of Brent crude vs the daily percentage change of pump prices. If the spread consistently favors the pump side, the system is extracting margin.

3. What the cumulative spread chart shows — it's the running total of (pump daily % change minus crude daily % change). An upward-trending line means the pump side is consistently gaining more than crude justifies.

This copy should be in Greek, accessible, non-academic. Think newspaper explainer, not research paper.

### Chart C: Cumulative Spread (Hero Analysis Chart)

**What it shows:** Running sum of (unleaded 95 daily % change − Brent daily % change) over time.

**Purpose:** The "smoking gun" — a single line that answers "are refineries profiting from volatility?" If the line trends up, yes.

**Chart config:**
- Y-axis: Cumulative percentage points
- Single line, bold (2px), colored `#e76f51` (warm orange — attention-grabbing)
- Zero line: horizontal, solid, dark gray — this is the "fair" line
- Area fill: above zero filled with `rgba(231, 111, 81, 0.1)`, below zero filled with `rgba(42, 157, 143, 0.1)` — red-ish above (pump winning), green-ish below (crude winning)
- Annotation: if the line is above zero at the right edge, a label: "Σωρευτικό πλεονέκτημα αντλίας: +X.X π.μ." (Cumulative pump advantage: +X.X percentage points)

### Chart D: Daily % Change Overlay

**What it shows:** Two overlaid lines — daily % change of Unleaded 95 and daily % change of Brent crude.

**Purpose:** The raw signal — see the day-by-day relationship. Most useful when zoomed into a specific period of volatility.

**Chart config:**
- Y-axis: Daily % change (shared scale)
- Two series:
  - Unleaded 95 % change: `#e63946` (red)
  - Brent % change: `#2a9d8f` (teal)
- Zero line: horizontal reference
- This chart is noisy by nature (daily data). Default view should be 3M to show meaningful patterns without overwhelming. "All" view will be very spiky.

---

## Section 4: Open Data — Detailed Spec

### Layout

Clean, simple section with download links. No chart.

### Content

Heading: "Ανοιχτά Δεδομένα — Κατεβάστε τα"

Brief copy: "Όλα τα δεδομένα που χρησιμοποιούμε είναι ελεύθερα διαθέσιμα. Μπορείτε να τα κατεβάσετε και να τα αναλύσετε μόνοι σας."

Download links (styled as a list with download icons):
- Τιμές καυσίμων Ελλάδας (CSV) → `fuel_prices.csv`
- Τιμές Brent Crude (CSV) → `brent_prices.csv`
- Ενοποιημένα δεδομένα ανάλυσης (JSON) → `fuel-chart.json`

### Methodology note

Small text block at the bottom:
- Data source: fuelprices.gr (Υπ. Ανάπτυξης), FRED / St. Louis Fed
- Update frequency: Daily
- What the numbers represent: National weighted average pump prices, Brent crude futures closing price
- License: CC BY 4.0 (matching the site footer)

---

## Chart Interaction Spec (All Charts)

### Range Preset Buttons

Positioned above each chart, right-aligned. Pill-shaped buttons in a button group.

| Button | Behavior |
|---|---|
| 1Μ | Last 30 days |
| 3Μ | Last 90 days |
| 6Μ | Last 180 days |
| 1Ε | Last 365 days |
| Όλα | Full dataset |

Active button is highlighted (filled accent color). Others are outlined/muted.

Default on page load: **1Y** for Section 2 charts (price history), **All** for Section 3 charts (analysis).

### Zoom Behavior

- **Click-drag** horizontally to zoom into a range. uPlot built-in.
- **Double-click** to reset to the active range preset.
- **Scroll-wheel** zoom: **disabled**. Rationale: on a page with multiple charts and scrollable content, wheel-zoom creates a UX trap — users trying to scroll the page accidentally zoom a chart. This is the single most common chart UX complaint. Deliberately disabled.
- **Pinch-to-zoom on mobile:** Also disabled for the same reason — too easy to trigger accidentally while scrolling. Users use the range buttons instead.

### Tooltip Behavior

- **Desktop:** Vertical crosshair line follows mouse. Tooltip box appears near cursor showing:
  - Date (formatted: "16 Μαρ 2026")
  - All visible series values at that date
  - For Section 3 charts: the spread value
- **Mobile:** Tap to place crosshair. Tap elsewhere to dismiss. Tooltip appears above the chart (fixed position) to avoid finger occlusion.
- Tooltip styling: white background, subtle shadow, small text, rounded corners. Matches site's `$shadow-sm` and `$radius`.

### Legend

- Built into uPlot below the chart
- Click series name to toggle visibility
- Color swatches match line colors
- Muted styling — not a visual distraction

### Loading State

- Chart container shows a muted pulsing skeleton rectangle (`$color-subtle-bg` with opacity animation)
- Replaced by chart once data loads
- Data loads once for the whole page (single JSON fetch), so all charts appear together

### Error State

- If fetch fails: chart container shows "Δεν ήταν δυνατή η φόρτωση δεδομένων. Δοκιμάστε ξανά αργότερα." with a retry link.

---

## Data JSON Schema (Updated)

The build-time JSON must now include both absolute prices AND percentage changes, since Section 2 needs absolute values and Section 3 needs % changes:

```json
{
  "updated": "2026-03-17",
  "latest": {
    "date": "2026-03-16",
    "unleaded_95": 1.924,
    "unleaded_100": 2.115,
    "diesel": 1.902,
    "autogas": 1.218,
    "heating_diesel": 1.470,
    "brent": 94.35,
    "avg_365": {
      "unleaded_95": 1.846,
      "unleaded_100": 2.031,
      "diesel": 1.752,
      "autogas": 1.089,
      "heating_diesel": 1.320,
      "brent": 78.42
    }
  },
  "series": {
    "timestamps": [1672531200, 1672617600, ...],
    "unleaded_95": [1.842, 1.846, ...],
    "diesel": [1.795, 1.796, ...],
    "unleaded_100": [2.046, 2.047, ...],
    "brent": [80.36, 75.31, ...],
    "pct_unleaded_95": [null, 0.22, ...],
    "pct_brent": [null, -6.28, ...],
    "cumulative_spread": [0, 6.50, ...]
  }
}
```

This gives the frontend everything pre-computed. Zero math in the browser.

---

## Charting Library: uPlot via CDN

~8 KB gzipped. Built specifically for time-series with native zoom/pan.

| | uPlot | Chart.js | Plotly | ECharts |
|---|---|---|---|---|
| Size (gz) | **8 KB** | 65 KB | 250 KB | 300 KB |
| 1000+ daily points | Excellent | Sluggish | OK | Good |
| Zoom/pan | Built-in | Plugin | Built-in | Built-in |
| Time-series native | Yes | No | Yes | Yes |

CDN:
```
https://cdn.jsdelivr.net/npm/uplot@1.6.31/dist/uPlot.iife.min.js
https://cdn.jsdelivr.net/npm/uplot@1.6.31/dist/uPlot.min.css
```

Loaded conditionally — only on pages that need charts (via `page_js` front matter).

---

## JS Architecture: Per-Page ES Modules, No Bundler

```
assets/
  js/
    lib/                       # Shared utilities (ES modules)
      chart-defaults.js        # uPlot defaults, color palette, responsive sizing
      data-loader.js           # fetch + cache JSON
      tooltip.js               # Custom tooltip factory
      format.js                # Number formatting (EUR, %, Greek locale)
    pages/
      fuel-charts.js           # /fuel page entry point
  data/
    fuel-chart.json            # Build-generated
    fuel_prices.csv            # Copied from _fuel-pdfs for download
    brent_prices.csv           # Copied from _fuel-pdfs for download
```

Loading mechanism — `default_raw.html` conditional block:

```html
{% if page.page_js %}
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/uplot@1.6.31/dist/uPlot.min.css">
<script src="https://cdn.jsdelivr.net/npm/uplot@1.6.31/dist/uPlot.iife.min.js"></script>
<script type="module" src="/assets/js/pages/{{ page.page_js }}.js"></script>
{% endif %}
```

---

## Sass

New partial `_sass/components/_fuel.scss` covering:
- Hero price cards (color variants, responsive grid)
- Chart containers and aspect ratios
- Range button group
- Tooltip overrides
- Loading skeleton animation
- Download links section
- Section spacing and typography

Imported in `main.scss`, follows existing component pattern.

---

## Implementation Phases

### Phase 1: Data pipeline
- Create `_scripts/generate_fuel_json.mjs` (merge CSVs → JSON with schema above)
- Add copy step for CSVs into `assets/data/` for download links
- Update `package.json` scripts

### Phase 2: Layout infrastructure
- Add conditional `page_js` loading to `default_raw.html`
- Create `_sass/components/_fuel.scss`, import in `main.scss`

### Phase 3: Shared JS utilities
- `assets/js/lib/chart-defaults.js`
- `assets/js/lib/data-loader.js`
- `assets/js/lib/tooltip.js`
- `assets/js/lib/format.js`

### Phase 4: Fuel page — Section 1 (Today's Prices)
- Create `/fuel/index.html` with front matter
- Hero price card + secondary cards
- Color coding logic based on 365-day average
- Seasonal heating diesel visibility

### Phase 5: Fuel page — Section 2 (Price History)
- Chart A: Unleaded 95 historical with rolling average line
- Chart B: Brent crude historical
- Side-by-side desktop / stacked mobile layout
- Range preset buttons

### Phase 6: Fuel page — Section 3 (Analysis)
- Explanatory copy (Greek)
- Chart C: Cumulative spread
- Chart D: Daily % change overlay

### Phase 7: Fuel page — Section 4 (Open Data)
- Download links
- Methodology note

### Phase 8: Polish
- Loading skeletons
- Error states
- Print-friendly styles
- Test mobile breakpoints

## Key Files to Modify

- `_layouts/default_raw.html` — conditional JS/CSS loading
- `_sass/main.scss` — import new fuel component
- `_sass/_variables.scss` — already has `$max-chart-width: 760px`
- `package.json` — add `fuel:json` script, update `fuel:update`

## Verification

1. `npm run fuel:update` produces valid `assets/data/fuel-chart.json`
2. `jekyll serve` and navigate to `/fuel` — page renders with all 4 sections
3. Hero card color matches price vs average relationship
4. All 4 charts render with real data
5. Range buttons switch timeframes correctly
6. Drag-zoom works, double-click resets
7. Scroll-wheel does NOT zoom charts (disabled)
8. Resize browser / test at 640px, 720px, 960px breakpoints
9. Download links serve valid files
10. Homepage and other pages load zero chart JS (check network tab)
