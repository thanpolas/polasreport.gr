# Daily Fuel Data Update Pipeline

## Context

The /fuel page currently serves data from static JSON built locally. Updating requires running scripts + rebuilding Jekyll + deploying. This is impractical for daily updates.

We need a pipeline that: fetches today's fuel PDF + Brent price, updates CSVs, regenerates JSON, and uploads to S3. The frontend fetches from S3 instead of the local Jekyll build. Triggered daily via GitHub Actions (no local machine dependency).

## Architecture

```
GitHub Actions (daily cron)
  ├─ fetch today's PDF from fuelprices.gr
  ├─ extract price with pdftotext
  ├─ append to fuel_prices.csv
  ├─ fetch Brent (FRED + Yahoo fallback)
  ├─ update brent_prices.csv
  ├─ regenerate fuel-chart.json
  ├─ upload to S3:
  │   ├─ fuel-chart.json
  │   ├─ fuel_prices.csv
  │   └─ brent_prices.csv
  └─ commit updated CSVs back to repo
```

Frontend: `fetch("https://data.polasreport.gr/fuel-chart.json")` (S3 + CloudFront)

## Changes Required

### 1. New script: `_scripts/fetch_today_pdf.mjs`

Fetches today's (or most recent) PDF bulletin from fuelprices.gr and extracts the price. Unlike `extract_fuel_prices.mjs` which scans a folder of 1,100+ PDFs, this fetches a single day.

Steps:
- Determine today's date, format as `DD_MM_YYYY`
- Download `https://www.fuelprices.gr/files/deltia/IMERISIO_DELTIO_PANELLINIO_{date}.pdf` to a temp file
- If 404 (weekend/holiday), try yesterday, day before (up to 3 days back)
- Run `pdftotext` on it, extract prices (reuse existing parsing logic)
- Append to `_fuel-pdfs/fuel_prices.csv` if date not already present
- Clean up temp file

### 2. Refactor: extract shared parsing logic

Move the PDF text parsing (regex for fuel prices) from `extract_fuel_prices.mjs` into a shared module `_scripts/lib/parse-fuel-pdf.mjs` so both the bulk scanner and the daily fetcher use the same code.

### 3. Update `fetch_brent_prices.mjs`

Already works incrementally. No changes needed. It fetches from FRED + Yahoo fallback.

### 4. Update `generate_fuel_json.mjs`

Already works. No changes needed. Reads CSVs, outputs JSON + copies CSVs to `assets/data/`.

But the output path for S3 upload should also go to a known location. Current output `assets/data/` is fine since the upload script reads from there.

### 5. New script: `_scripts/upload_to_s3.mjs`

Uploads the 3 data files to S3 using AWS CLI (available in GitHub Actions runners natively).

Actually, simpler: just use `aws s3 cp` commands in the GitHub Actions workflow directly. No need for a separate script.

Files to upload:
- `assets/data/fuel-chart.json` (Content-Type: application/json, Cache-Control: max-age=1800)
- `assets/data/fuel_prices.csv` (Content-Type: text/csv)
- `assets/data/brent_prices.csv` (Content-Type: text/csv)

### 6. Update frontend: `DATA_URL`

Change from:
```js
const DATA_URL = "/assets/data/fuel-chart.json";
```
To:
```js
const DATA_URL = "https://data.polasreport.gr/fuel-chart.json";
```

The download links in `fuel/index.html` also need updating to point to S3.

Fallback: if S3 fetch fails, fall back to local `/assets/data/fuel-chart.json` (the last build-time version). This ensures the page never fully breaks.

### 7. AWS S3 Setup

**Bucket:** `polasreport-data` (or similar)
- Region: eu-south-1 (Athens) or eu-central-1 (Frankfurt)
- Public read access for the 3 data files
- CORS: allow `https://polasreport.gr` and `http://localhost:4000`

**CloudFront (optional but recommended):**
- Custom domain: `data.polasreport.gr`
- CNAME in DNS pointing to CloudFront distribution
- Auto-HTTPS via ACM certificate
- Cache TTL: 30 minutes (data updates once daily, but short TTL means updates propagate fast)

**Without CloudFront (simpler):**
- Direct S3 URL: `https://polasreport-data.s3.eu-central-1.amazonaws.com/fuel-chart.json`
- Still works, just no custom domain or edge caching

### 8. GitHub Actions workflow: `fuel-daily-update.yml`

```yaml
name: Daily Fuel Data Update
on:
  schedule:
    - cron: '0 14 * * *'  # 14:00 UTC = 17:00 Athens (after market close)
  workflow_dispatch: {}     # manual trigger

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install poppler (for pdftotext)
        run: sudo apt-get install -y poppler-utils

      - name: Fetch today's fuel PDF
        run: node _scripts/fetch_today_pdf.mjs

      - name: Fetch Brent prices
        run: node _scripts/fetch_brent_prices.mjs

      - name: Generate JSON
        run: node _scripts/generate_fuel_json.mjs

      - name: Upload to S3
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_DEFAULT_REGION: eu-central-1
        run: |
          aws s3 cp assets/data/fuel-chart.json s3://polasreport-data/fuel-chart.json \
            --content-type application/json \
            --cache-control "max-age=1800"
          aws s3 cp assets/data/fuel_prices.csv s3://polasreport-data/fuel_prices.csv \
            --content-type "text/csv; charset=utf-8"
          aws s3 cp assets/data/brent_prices.csv s3://polasreport-data/brent_prices.csv \
            --content-type "text/csv; charset=utf-8"

      - name: Commit updated CSVs
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add _fuel-pdfs/fuel_prices.csv _fuel-pdfs/brent_prices.csv
          git diff --staged --quiet || git commit -m "daily fuel data update $(date +%Y-%m-%d)"
          git push
```

### 9. Update `package.json`

Add new scripts:
```json
{
  "fuel:today": "node _scripts/fetch_today_pdf.mjs",
  "fuel:daily": "npm run fuel:today && npm run fuel:brent && npm run fuel:json"
}
```

`fuel:daily` is the lightweight daily update (single PDF + Brent + JSON).
`fuel:update` remains the full rebuild (all PDFs + Brent + JSON).

### 10. GitHub Secrets Required

- `AWS_ACCESS_KEY_ID` - IAM user with S3 put access
- `AWS_SECRET_ACCESS_KEY`

## Files to Create

- `_scripts/fetch_today_pdf.mjs` - fetch + extract single day's PDF
- `_scripts/lib/parse-fuel-pdf.mjs` - shared PDF parsing logic
- `.github/workflows/fuel-daily-update.yml` - daily cron workflow

## Files to Modify

- `_scripts/extract_fuel_prices.mjs` - import shared parser instead of inline
- `assets/js/pages/fuel-charts.js` - change DATA_URL to S3
- `assets/js/lib/data-loader.js` - add fallback logic
- `fuel/index.html` - update download links to S3 URLs
- `package.json` - add fuel:today and fuel:daily scripts

## Verification

1. Run `npm run fuel:daily` locally, verify CSV gets one new row
2. Run `npm run fuel:json`, verify JSON updated date
3. Create S3 bucket, configure CORS, upload manually, verify `curl` works
4. Test frontend with S3 URL, verify charts load
5. Test fallback: block S3, verify local data still works
6. Trigger GitHub Actions workflow manually, verify end-to-end
7. Next day: verify cron ran and data updated
