# Crude Oil Benchmark Research for Greek Fuel Prices

## Crude Oil Input: Dated Brent

Greek refineries (HELLENiQ Energy, Motor Oil Hellas) use **Dated Brent** (Platts Dated Brent) as their primary crude oil pricing reference. This is the standard for the entire Mediterranean basin.

Physical crude oil cargoes are priced as **Dated Brent +/- a differential** (premium or discount depending on crude grade quality and market conditions). There is no separate Mediterranean crude benchmark — Dated Brent is the anchor.

Key crude sources for Greek refineries (from HELLENiQ Energy reporting): Iraq (28%), Kazakhstan (24%), Middle East (14%), Libya (13%), Egypt (8%), Azerbaijan (4%). All priced relative to Dated Brent.

Motor Oil Hellas confirms in its 2024 annual report that it uses "international Platt's prices in USD" for oil purchases and sales.

## Refined Product Benchmarks: Platts Mediterranean

For refined products, Greek refineries reference **S&P Global Platts Mediterranean assessments**:

| Product | Assessment | Exchange |
|---|---|---|
| Gasoline | Premium Unleaded 10ppm FOB MED (Platts) | NYMEX |
| Diesel/ULSD | ULSD 10ppm Cargoes CIF MED (Platts) | NYMEX |
| Gasoil | Gasoil 0.1% Cargoes CIF MED (Platts) | NYMEX |
| Fuel Oil | 3.5% Fuel Oil CIF MED (Platts) | NYMEX |

These require a **paid S&P Global Commodity Insights subscription**. No free public API.

## Free Data Sources

| Data | Ticker | Source | Cost |
|---|---|---|---|
| Brent Crude (daily) | `DCOILBRENTEU` | FRED (St. Louis Fed) | Free REST API |
| Brent Crude Futures | `BZ=F` | Yahoo Finance (`yfinance`) | Free |
| Brent & WTI historical | CSV | github.com/datasets/oil-prices (EIA) | Free |

### FRED API

- Series: `DCOILBRENTEU` (daily), `MCOILBRENTEU` (monthly)
- URL: https://fred.stlouisfed.org/series/DCOILBRENTEU
- Free REST API, no auth required for basic access

### Approximate Med Product Proxy

ICE Low Sulphur Gasoil futures (`LF` on Barchart) minus Brent crude (`BZ=F`) gives a rough NW European gasoil crack that closely tracks Mediterranean margins.

## Decision

Use **FRED `DCOILBRENTEU`** as the crude oil benchmark. Comparing Brent crude against Greek pump prices shows the markup/spread (taxes + refining margin + distribution) over time.

Brent price is in **USD/barrel** — needs conversion to **EUR/liter** for comparison with pump prices:
- 1 barrel = 159 liters
- USD to EUR conversion needed (ECB daily rates or FRED `DEXUSEU`)

## Sources

- HELLENiQ Energy Annual Report 2022 — Business Activities
- HELLENiQ Energy 3Q/9M 2025 Financial Results
- Motor Oil Hellas Annual Financial Report 2024
- Platts Dated Brent Price Assessment (spglobal.com)
- ICE: Daily Crude Diff — Dated Brent vs Mediterranean Dated Strip
- CME: Premium Unleaded Gasoline 10ppm FOB MED (Platts)
- CME: ULSD 10ppm Cargoes CIF MED (Platts)
- FRED: Crude Oil Prices Brent Europe (DCOILBRENTEU)
