# polasreport.gr

Welcome to polasreport.gr

## Launch Local

```
jekyll serve -l --watch
```

## Run locally with Docker (starefossen/github-pages)

Build + run in foreground:
```
docker compose up --build
```

Or build first, then run detached:
```
docker compose build
docker compose up -d
docker compose logs -f jekyll
```

Open browser: [http://localhost:4000](http://localhost:4000)



## Fuel Prices Data Pipeline

We collect daily Greek fuel prices from [fuelprices.gr](https://www.fuelprices.gr/deltia_d.view) PDF bulletins and extract them into a CSV for use on the `/fuel` route.

### Folder Structure

```
_fuel-pdfs/
├── pdfs/                    # Raw PDF bulletins (1 per day)
├── fuel_prices.csv          # Extracted pump prices (generated, do not edit)
├── brent_prices.csv         # Brent crude daily close in USD/barrel (generated)
├── crude-research.md        # Research on which benchmark Greek refineries use
├── pdf-urls-3yr.txt         # URL list used for downloading
└── deltia.html              # Cached index page

_scripts/
├── extract_fuel_prices.mjs  # PDF → CSV extraction (requires pdftotext)
└── fetch_brent_prices.mjs   # Brent crude prices from FRED (zero dependencies)
```

### How It Works

1. PDFs are downloaded from fuelprices.gr (daily bulletins with national average fuel prices)
2. `extract_fuel_prices.mjs` scans `_fuel-pdfs/pdfs/`, extracts prices from each PDF, and appends to `fuel_prices.csv`
3. `fetch_brent_prices.mjs` fetches Brent crude daily prices from the FRED public API into `brent_prices.csv`
4. Both scripts are incremental — already-processed entries are skipped on re-run

### Running the Scripts

```bash
# Run both (fetch Brent prices + extract pump prices from PDFs)
npm run fuel:update

# Or individually:
npm run fuel:brent    # Fetch Brent crude prices from FRED
npm run fuel:extract  # Extract pump prices from PDFs (requires pdftotext / poppler)
```

All scripts are vanilla Node.js ESM modules with zero npm dependencies. The CSV columns are:

| Column | Description |
|---|---|
| `date` | Date in YYYY-MM-DD format |
| `unleaded_95` | Unleaded 95 octane (EUR/liter) |
| `unleaded_100` | Unleaded 100 octane (EUR/liter) |
| `diesel` | Automotive diesel (EUR/liter) |
| `autogas` | LPG/Autogas (EUR/liter) |
| `heating_diesel` | Heating diesel (EUR/liter, seasonal) |
| `filename` | Source PDF filename |

`brent_prices.csv`:

| Column | Description |
|---|---|
| `date` | Date in YYYY-MM-DD format |
| `price` | Brent crude closing price (USD/barrel) |

### Fetching New PDFs

```bash
# Download the index page
wget -q -O ./_fuel-pdfs/deltia.html https://www.fuelprices.gr/deltia_d.view

# Extract PDF URLs (adjust year filter as needed)
grep -o 'href="./files/deltia/[^"]*\.pdf"' ./_fuel-pdfs/deltia.html \
  | sed 's|href="./|https://www.fuelprices.gr/|;s/"//' \
  | sort -u | grep -E '_202[3-6]\.' > ./_fuel-pdfs/pdf-urls-3yr.txt

# Download in parallel (10 concurrent)
cat ./_fuel-pdfs/pdf-urls-3yr.txt | xargs -P 10 -I {} wget -q -nc -nd -P ./_fuel-pdfs/pdfs {}
```

Note: `_fuel-pdfs/` is prefixed with `_` so Jekyll excludes it from the published site.

## Iconography & Social Actions

We use Boxicons (https://boxicons.com) via CDN to provide consistent, lightweight social icons across the site. The stylesheet is loaded once in `_layouts/default.html` using:

```html
<link rel="stylesheet" href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css">
```

Usage example in templates:

```html
<a class="social-icon social-icon--x" href="https://x.com/username" aria-label="Open on X">
	<i class="bx bxl-twitter" aria-hidden="true"></i>
</a>
```

Notes:
- The `bxl` prefix indicates a brand icon (eg `bxl-youtube`, `bxl-tiktok`, `bxl-facebook-square`).
- We choose muted icons with subtle hover accents to maintain discrete legibility.
- The `youtube` link is shown in the same social action bar and contains a label (`Watch on YouTube`) to clarify action, displayed on wider viewports and hidden on small screens.

