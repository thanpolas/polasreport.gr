/**
 * /fuel page entry point.
 * Fetches data, renders price cards and all charts.
 */

import { COLORS, responsiveSize, baseOpts, createRangeButtons, createSeriesToggle } from "../lib/chart-defaults.js";
import { fetchJSON } from "../lib/data-loader.js";
import { tooltipPlugin } from "../lib/tooltip.js";
import { fmtDate, fmtEUR, fmtUSD, fmtPct, fmtDateFull } from "../lib/format.js";

// ---- Data utilities ----

/** Simple moving average. Nulls are skipped, output length matches input. */
function sma(arr, window) {
  const out = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    if (i < window - 1) { out[i] = null; continue; }
    let sum = 0, count = 0;
    for (let j = i - window + 1; j <= i; j++) {
      if (arr[j] != null) { sum += arr[j]; count++; }
    }
    out[i] = count > 0 ? Math.round(sum / count * 1000) / 1000 : null;
  }
  return out;
}

/** Clamp values to ±limit, reducing outlier impact on scale. */
function clamp(arr, limit) {
  return arr.map((v) => v == null ? null : Math.max(-limit, Math.min(limit, v)));
}

/** Compute daily % change array from a price series. */
function pctChangeSeries(arr) {
  return arr.map((v, i) => {
    if (i === 0 || v == null || arr[i - 1] == null || arr[i - 1] === 0) return null;
    return Math.round(((v - arr[i - 1]) / arr[i - 1]) * 100 * 1000) / 1000;
  });
}

const FUEL_TYPES = {
  unleaded_95:  { key: "unleaded_95",  label: "95",     fullLabel: "Αμόλυβδη 95",  chartLabel: "Αμόλυβδη 95 (EUR/λίτρο)" },
  diesel:       { key: "diesel",       label: "Diesel",  fullLabel: "Diesel Κίνησης", chartLabel: "Diesel (EUR/λίτρο)" },
  unleaded_100: { key: "unleaded_100", label: "100",    fullLabel: "Αμόλυβδη 100", chartLabel: "Αμόλυβδη 100 (EUR/λίτρο)" },
  autogas:      { key: "autogas",      label: "LPG",    fullLabel: "Autogas (LPG)", chartLabel: "Autogas (EUR/λίτρο)" },
};

const DATA_URL = "https://polasreport-data.s3.us-west-1.amazonaws.com/fuel-chart.json";
const DATA_FALLBACK = "/assets/data/fuel-chart.json";

// ---- Helpers ----

function colorClass(price, avg) {
  if (price == null || avg == null) return "amber";
  const pct = ((price - avg) / avg) * 100;
  if (pct < 0) return "green";
  if (pct <= 10) return "amber";
  return "red";
}

function deltaHTML(price, avg) {
  if (price == null || avg == null) return "";
  const pct = ((price - avg) / avg) * 100;
  const arrow = pct >= 0 ? "&#9650;" : "&#9660;";
  const cls = pct >= 0 ? "up" : "down";
  const abs = Math.abs(pct).toFixed(1);
  const dir = pct >= 0 ? "πάνω από" : "κάτω από";
  return `<span class="fuel-hero-delta fuel-hero-delta--${cls}">${arrow} ${abs}% ${dir} τον μέσο όρο έτους</span>`;
}

function deltaHTMLSmall(price, avg) {
  if (price == null || avg == null) return "";
  const pct = ((price - avg) / avg) * 100;
  const arrow = pct >= 0 ? "&#9650;" : "&#9660;";
  const cls = pct >= 0 ? "up" : "down";
  return `<span class="fuel-card-delta fuel-card-delta--${cls}">${arrow} ${Math.abs(pct).toFixed(1)}%</span>`;
}

// ---- Section 1: Price Cards ----

function renderPriceCards(data) {
  const { latest } = data;
  const avg = latest.avg_365;

  // Hero card
  const hero = document.getElementById("fuel-hero");
  const heroColor = colorClass(latest.unleaded_95, avg.unleaded_95);
  hero.className = `fuel-hero-card fuel-hero-card--${heroColor}`;
  hero.innerHTML = `
    <div class="fuel-hero-label">Αμόλυβδη 95</div>
    <div class="fuel-hero-price">&euro;${fmtEUR(latest.unleaded_95)}</div>
    ${deltaHTML(latest.unleaded_95, avg.unleaded_95)}
    <div class="fuel-hero-avg">Μέσος όρος 365 ημερών: &euro;${fmtEUR(avg.unleaded_95)}</div>
  `;

  // Secondary cards
  const cards = [
    { label: "Diesel Κίνησης", price: latest.diesel, avg: avg.diesel },
    { label: "Αμόλυβδη 100", price: latest.unleaded_100, avg: avg.unleaded_100 },
    { label: "Autogas (LPG)", price: latest.autogas, avg: avg.autogas },
  ];

  // Add heating diesel if in season (Oct-Apr)
  const month = new Date().getMonth(); // 0-indexed
  if (month >= 9 || month <= 3) {
    if (latest.heating_diesel) {
      cards.push({
        label: "Πετρέλαιο Θέρμανσης",
        price: latest.heating_diesel,
        avg: avg.heating_diesel,
      });
    }
  }

  const container = document.getElementById("fuel-secondary-cards");
  container.innerHTML = cards
    .map((c) => {
      const color = colorClass(c.price, c.avg);
      return `<div class="fuel-card fuel-card--${color}">
        <div class="fuel-card-label">${c.label}</div>
        <div class="fuel-card-price">&euro;${fmtEUR(c.price)}</div>
        ${deltaHTMLSmall(c.price, c.avg)}
      </div>`;
    })
    .join("");

  // Update timestamp
  document.getElementById("fuel-updated").textContent =
    `Τελευταία ενημέρωση: ${fmtDateFull(latest.date)}`;
}

// ---- Chart Factory ----

function mountChart(containerId, opts, data, defaultRange) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const { width, height } = responsiveSize(container);
  opts.width = width;
  opts.height = height;

  container.innerHTML = "";
  const chart = new uPlot(opts, data, container);

  // Responsive resize
  const ro = new ResizeObserver(() => {
    const size = responsiveSize(container);
    chart.setSize(size);
  });
  ro.observe(container);

  // Range buttons
  createRangeButtons(container, chart, data[0], defaultRange);

  // Double-click to reset
  chart.over.addEventListener("dblclick", () => {
    chart.setScale("x", {
      min: data[0][0],
      max: data[0][data[0].length - 1],
    });
  });

  return chart;
}

// ---- FX mode state (EUR-adjusted vs raw USD) ----

/** Global FX mode: "eur" (default) or "usd". Listeners are notified on change. */
const fxState = {
  mode: "eur",
  listeners: [],
  set(mode) {
    this.mode = mode;
    this.listeners.forEach((fn) => fn(mode));
  },
  on(fn) { this.listeners.push(fn); },
};

/** Global fuel selection. Listeners are notified on change. */
const fuelState = {
  key: "unleaded_95",
  listeners: [],
  set(key) {
    this.key = key;
    this.listeners.forEach((fn) => fn(key));
  },
  on(fn) { this.listeners.push(fn); },
};

// ---- Section 2: Price History Charts ----

function renderHistoryCharts(data) {
  const { timestamps, brent, brent_eur } = data.series;
  const hasFx = brent_eur && brent_eur.some((v) => v != null);

  // Chart A: Fuel price history — responds to fuel selector
  const fuelTitleEl = document.getElementById("fuel-chart-title");

  function fuelChartOpts(fuelKey) {
    const ft = FUEL_TYPES[fuelKey];
    return {
      ...baseOpts(null),
      series: [
        {},
        {
          label: ft.fullLabel,
          stroke: COLORS.unleaded95,
          width: 1.5,
          fill: COLORS.unleaded95 + "14",
        },
      ],
      axes: [
        baseOpts(null).axes[0],
        {
          ...baseOpts(null).axes[1],
          values: (u, vals) => vals.map((v) => v != null ? fmtEUR(v) : ""),
        },
      ],
      plugins: [
        tooltipPlugin([(v) => `€${fmtEUR(v)}`], [COLORS.unleaded95]),
      ],
    };
  }

  let fuelChart = mountChart(
    "chart-unleaded95",
    fuelChartOpts("unleaded_95"),
    [timestamps, data.series.unleaded_95],
    "1Y",
  );

  // Fuel selector pills
  const fuelContainer = document.getElementById("chart-unleaded95");
  if (fuelContainer) {
    const fuelBtns = {};
    const rangeBtns = fuelContainer.querySelector(".fuel-range-btns");

    // Check which fuels have enough data
    for (const [key, ft] of Object.entries(FUEL_TYPES)) {
      const series = data.series[key];
      const hasData = series && series.filter((v) => v != null).length > 30;

      const btn = document.createElement("button");
      btn.className = "fuel-range-btn" + (key === "unleaded_95" ? " active" : "");
      btn.textContent = ft.label;
      if (!hasData) {
        btn.disabled = true;
        btn.style.opacity = "0.3";
        btn.style.cursor = "default";
      } else {
        btn.addEventListener("click", () => fuelState.set(key));
      }
      fuelBtns[key] = btn;
    }

    // Insert fuel pills into range buttons row with separator
    if (rangeBtns) {
      const sep = document.createElement("span");
      sep.className = "fuel-range-sep";
      const keys = Object.keys(FUEL_TYPES);
      for (let i = keys.length - 1; i >= 0; i--) {
        rangeBtns.prepend(fuelBtns[keys[i]]);
      }
      rangeBtns.insertBefore(sep, fuelBtns[keys[keys.length - 1]].nextSibling);
    }

    fuelState.on((key) => {
      Object.entries(fuelBtns).forEach(([k, b]) => b.classList.toggle("active", k === key));

      const ft = FUEL_TYPES[key];
      if (fuelTitleEl) fuelTitleEl.textContent = ft.chartLabel;

      // Rebuild fuel chart
      fuelContainer.querySelector(".uplot")?.remove();
      fuelContainer.querySelector(".fuel-range-btns")?.remove();

      fuelChart = mountChart(
        "chart-unleaded95",
        fuelChartOpts(key),
        [timestamps, data.series[key]],
        "1Y",
      );

      // Re-inject fuel pills into new range buttons row
      const newRangeBtns = fuelContainer.querySelector(".fuel-range-btns");
      if (newRangeBtns) {
        const sep = document.createElement("span");
        sep.className = "fuel-range-sep";
        const keys = Object.keys(FUEL_TYPES);
        for (let i = keys.length - 1; i >= 0; i--) {
          newRangeBtns.prepend(fuelBtns[keys[i]]);
        }
        newRangeBtns.insertBefore(sep, fuelBtns[keys[keys.length - 1]].nextSibling);
      }
    });
  }

  // Chart B: Brent — defaults to EUR-adjusted when available
  const brentTitleEl = document.getElementById("brent-chart-title");

  function brentChartOpts(isEur) {
    return {
      ...baseOpts(null),
      series: [
        {},
        {
          label: isEur ? "Brent Crude (EUR)" : "Brent Crude (USD)",
          stroke: COLORS.brent,
          width: 1.5,
          fill: COLORS.brent + "14",
        },
      ],
      axes: [
        baseOpts(null).axes[0],
        {
          ...baseOpts(null).axes[1],
          values: (u, vals) => vals.map((v) =>
            v != null ? (isEur ? `€${v.toFixed(0)}` : `$${v.toFixed(0)}`) : "",
          ),
        },
      ],
      plugins: [
        tooltipPlugin([(v) => isEur ? `€${v.toFixed(2)}` : fmtUSD(v)], [COLORS.brent]),
      ],
    };
  }

  const defaultEur = hasFx;
  let brentChart = mountChart(
    "chart-brent",
    brentChartOpts(defaultEur),
    [timestamps, defaultEur ? brent_eur : brent],
    "1Y",
  );

  if (brentTitleEl) {
    brentTitleEl.innerHTML = defaultEur
      ? "Brent Crude (EUR/βαρέλι) <span class='fuel-chart-title-note'>*</span>"
      : "Brent Crude (USD/βαρέλι)";
  }

  // FX toggle — only if EUR data exists
  if (hasFx) {
    const container = document.getElementById("chart-brent");

    const btnEur = document.createElement("button");
    btnEur.className = "fuel-range-btn active";
    btnEur.textContent = "EUR";
    btnEur.addEventListener("click", () => fxState.set("eur"));

    const btnUsd = document.createElement("button");
    btnUsd.className = "fuel-range-btn";
    btnUsd.textContent = "USD";
    btnUsd.addEventListener("click", () => fxState.set("usd"));

    function setFxButtons(mode) {
      btnEur.classList.toggle("active", mode === "eur");
      btnUsd.classList.toggle("active", mode === "usd");
    }

    // Insert into the existing range buttons row
    const rangeBtns = container.querySelector(".fuel-range-btns");
    if (rangeBtns) {
      const sep = document.createElement("span");
      sep.className = "fuel-range-sep";
      rangeBtns.prepend(btnUsd);
      rangeBtns.prepend(btnEur);
      rangeBtns.insertBefore(sep, btnUsd.nextSibling);
    }

    fxState.on((mode) => {
      setFxButtons(mode);
      const isEur = mode === "eur";
      const seriesData = isEur ? brent_eur : brent;

      // Remove only the uPlot instance and range buttons
      container.querySelector(".uplot")?.remove();
      container.querySelector(".fuel-range-btns")?.remove();

      const opts = brentChartOpts(isEur);
      const { width, height } = responsiveSize(container);
      opts.width = width;
      opts.height = height;

      brentChart = new uPlot(opts, [timestamps, seriesData], container);

      const ro = new ResizeObserver(() => {
        brentChart.setSize(responsiveSize(container));
      });
      ro.observe(container);

      createRangeButtons(container, brentChart, timestamps, "1Y");

      // Re-inject FX buttons into the new range row
      const newRangeBtns = container.querySelector(".fuel-range-btns");
      if (newRangeBtns) {
        const sep = document.createElement("span");
        sep.className = "fuel-range-sep";
        newRangeBtns.prepend(btnUsd);
        newRangeBtns.prepend(btnEur);
        newRangeBtns.insertBefore(sep, btnUsd.nextSibling);
      }

      brentChart.over.addEventListener("dblclick", () => {
        brentChart.setScale("x", {
          min: timestamps[0],
          max: timestamps[timestamps.length - 1],
        });
      });

      if (brentTitleEl) {
        brentTitleEl.innerHTML = isEur
          ? "Brent Crude (EUR/βαρέλι) <span class='fuel-chart-title-note'>*</span>"
          : "Brent Crude (USD/βαρέλι)";
      }
    });
  }
}

// ---- Section 3: Analysis Charts ----

function renderAnalysisCharts(data) {
  const { timestamps, cumulative_spread, pct_unleaded_95, pct_brent, pct_brent_eur } = data.series;
  const hasFx = pct_brent_eur && pct_brent_eur.some((v) => v != null);

  // Precompute % change series for all fuels
  const fuelPctCache = {};
  fuelPctCache.unleaded_95 = pct_unleaded_95; // already in JSON
  for (const key of Object.keys(FUEL_TYPES)) {
    if (key !== "unleaded_95") {
      fuelPctCache[key] = pctChangeSeries(data.series[key] || []);
    }
  }

  function activeFuelPct() {
    return fuelPctCache[fuelState.key] || pct_unleaded_95;
  }

  // Pick the active Brent % series based on FX mode
  function activeBrentPct() {
    return (hasFx && fxState.mode === "eur") ? pct_brent_eur : pct_brent;
  }

  // Chart C: Cumulative spread — recomputed per range, reset to 0 at range start
  const SPREAD_CLAMP = 10;
  let clampedFuelPct = clamp(activeFuelPct(), SPREAD_CLAMP);

  function buildClampedBrentPct() {
    return clamp(activeBrentPct(), SPREAD_CLAMP);
  }

  let clampedBrentPct = buildClampedBrentPct();

  // Compute daily diff (fuel pct - brent pct), light 3-day smoothing
  function buildClampedFuelPct() {
    return clamp(activeFuelPct(), SPREAD_CLAMP);
  }

  function buildRawDiff() {
    const cfp = clampedFuelPct;
    const cbp = buildClampedBrentPct();
    return cfp.map((f, i) => {
      const b = cbp[i];
      if (f == null || b == null) return null;
      return Math.round((f - b) * 1000) / 1000;
    });
  }

  let rawDiff = buildRawDiff();
  let dailyDiff = sma(rawDiff, 3);

  /** Build cumulative spread from startIdx, resetting to 0. */
  function buildCumulative(startIdx) {
    const out = new Array(timestamps.length).fill(null);
    let running = 0;
    for (let i = startIdx; i < dailyDiff.length; i++) {
      if (dailyDiff[i] != null) running += dailyDiff[i];
      out[i] = Math.round(running * 1000) / 1000;
    }
    return out;
  }

  let currentCumulative = buildCumulative(0);
  let currentRangeLabel = "σύνολο";

  const annotEl = document.getElementById("fuel-spread-annotation");

  function updateAnnotation(cumData, rangeLabel, isHover = false) {
    const last = cumData.findLast((v) => v != null);
    if (last == null) { annotEl.innerHTML = ""; return; }
    const cls = last >= 0 ? "positive" : "negative";
    const prefix = isHover ? "" : `${rangeLabel}: `;
    annotEl.innerHTML = `<span class="fuel-spread-label fuel-spread-label--${cls}">` +
      `${prefix}${fmtPct(last)}</span>`;
  }

  const RANGE_LABELS = {
    "1M": "τελευταίος μήνας",
    "3M": "τελευταίο τρίμηνο",
    "6M": "τελευταίο εξάμηνο",
    "1Y": "τελευταίο έτος",
    "All": "σύνολο",
  };

  // Tooltip + live annotation sync
  function spreadTooltipPlugin() {
    let tooltipEl;

    function init(u) {
      tooltipEl = document.createElement("div");
      tooltipEl.className = "fuel-tooltip";
      tooltipEl.style.display = "none";
      u.over.appendChild(tooltipEl);
    }

    function setCursor(u) {
      const { idx } = u.cursor;
      if (idx == null) {
        tooltipEl.style.display = "none";
        // Restore annotation to endpoint
        updateAnnotation(currentCumulative, currentRangeLabel);
        return;
      }

      const ts = u.data[0][idx];
      const cumVal = u.data[1][idx];
      const diffVal = rawDiff[idx]; // show unsmoothed daily diff in tooltip

      // Sync the annotation badge to cursor position
      if (cumVal != null) {
        const cls = cumVal >= 0 ? "positive" : "negative";
        annotEl.innerHTML = `<span class="fuel-spread-label fuel-spread-label--${cls}">` +
          `${fmtDate(ts)}: ${fmtPct(cumVal)}</span>`;
      }

      let html = `<div class="fuel-tooltip-date">${fmtDate(ts)}</div>`;
      html += `<div class="fuel-tooltip-row">
        <span class="fuel-tooltip-swatch" style="background:${COLORS.spread}"></span>
        Σωρευτικά: <strong>${cumVal != null ? fmtPct(cumVal) : "—"}</strong>
      </div>`;
      if (diffVal != null) {
        html += `<div class="fuel-tooltip-row">
          <span class="fuel-tooltip-swatch" style="background:#aaa"></span>
          Ημέρας: <strong>${fmtPct(diffVal)}</strong>
        </div>`;
      }

      tooltipEl.innerHTML = html;
      tooltipEl.style.display = "block";

      const { left, top } = u.cursor;
      const overRect = u.over.getBoundingClientRect();
      const ttRect = tooltipEl.getBoundingClientRect();
      let x = left + 15;
      let y = top - 10;
      if (x + ttRect.width > overRect.width) x = left - ttRect.width - 15;
      if (y + ttRect.height > overRect.height) y = overRect.height - ttRect.height - 5;
      if (y < 0) y = 5;
      tooltipEl.style.left = x + "px";
      tooltipEl.style.top = y + "px";
    }

    return { hooks: { init: [init], setCursor: [setCursor] } };
  }

  // Dynamic gradient fill: warm above zero, cool below
  function gradientFill(u) {
    const ctx = u.ctx;
    const zeroY = u.valToPos(0, "y", true);
    if (!isFinite(zeroY)) return "rgba(231,111,81,0.08)";

    const top = u.bbox.top;
    const bot = u.bbox.top + u.bbox.height;
    const grad = ctx.createLinearGradient(0, top, 0, bot);

    // Above zero = warm (pump gaining)
    const zeroRatio = Math.max(0, Math.min(1, (zeroY - top) / (bot - top)));
    grad.addColorStop(0, "rgba(231,111,81,0.15)");
    grad.addColorStop(Math.max(0, zeroRatio - 0.01), "rgba(231,111,81,0.04)");
    grad.addColorStop(zeroRatio, "rgba(0,0,0,0)");
    // Below zero = cool (crude gaining)
    grad.addColorStop(Math.min(1, zeroRatio + 0.01), "rgba(42,157,143,0.04)");
    grad.addColorStop(1, "rgba(42,157,143,0.12)");

    return grad;
  }

  // Draw hook: zero baseline + spike dots
  function drawOverlays(u) {
    const ctx = u.ctx;

    // Zero baseline
    const zeroY = u.valToPos(0, "y", true);
    if (isFinite(zeroY)) {
      ctx.save();
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(u.bbox.left, zeroY);
      ctx.lineTo(u.bbox.left + u.bbox.width, zeroY);
      ctx.stroke();
      ctx.restore();
    }

    // Spike markers: highlight days where |raw daily diff| > 7%
    const data = u.data[1];
    const xMin = u.scales.x.min;
    const xMax = u.scales.x.max;
    ctx.save();
    for (let i = 0; i < rawDiff.length; i++) {
      if (rawDiff[i] == null || Math.abs(rawDiff[i]) <= 7) continue;
      if (data[i] == null) continue;
      const tsVal = u.data[0][i];
      if (tsVal < xMin || tsVal > xMax) continue; // skip out-of-view
      const x = u.valToPos(tsVal, "x", true);
      const y = u.valToPos(data[i], "y", true);
      if (!isFinite(x) || !isFinite(y)) continue;
      ctx.fillStyle = rawDiff[i] > 0 ? "rgba(231,111,81,0.6)" : "rgba(42,157,143,0.6)";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const optsCum = {
    ...baseOpts(null),
    series: [
      {},
      {
        label: "Σωρευτική Απόκλιση",
        stroke: COLORS.spread,
        width: 2.75,
        fill: gradientFill,
      },
    ],
    axes: [
      baseOpts(null).axes[0],
      {
        ...baseOpts(null).axes[1],
        values: (u, vals) => vals.map((v) => v != null ? `${v.toFixed(1)}%` : ""),
      },
    ],
    plugins: [spreadTooltipPlugin()],
    hooks: {
      ...baseOpts(null).hooks,
      draw: [drawOverlays],
    },
  };

  const container = document.getElementById("chart-cumulative");
  if (!container) return;

  const { width, height } = responsiveSize(container);
  optsCum.width = width;
  optsCum.height = height;

  container.innerHTML = "";
  const cumChart = new uPlot(optsCum, [timestamps, currentCumulative], container);

  const ro = new ResizeObserver(() => {
    cumChart.setSize(responsiveSize(container));
  });
  ro.observe(container);

  cumChart.over.addEventListener("dblclick", () => {
    cumChart.setScale("x", {
      min: timestamps[0],
      max: timestamps[timestamps.length - 1],
    });
  });

  // Range buttons with recompute on change
  let lastRangeKey = "1Y";
  createRangeButtons(container, cumChart, timestamps, "1Y", (key, min, max) => {
    lastRangeKey = key;
    let startIdx = 0;
    for (let i = 0; i < timestamps.length; i++) {
      if (timestamps[i] >= min) { startIdx = i; break; }
    }
    currentCumulative = buildCumulative(startIdx);
    currentRangeLabel = RANGE_LABELS[key] || key;
    cumChart.setData([timestamps, currentCumulative], false);
    cumChart.setScale("x", { min, max });
    updateAnnotation(currentCumulative, currentRangeLabel);
  });

  // Respond to FX toggle — recompute diffs and cumulative
  fxState.on(() => recomputeCumulative());

  // Helper to recompute cumulative from current range
  function recomputeCumulative() {
    clampedFuelPct = buildClampedFuelPct();
    clampedBrentPct = buildClampedBrentPct();
    rawDiff = buildRawDiff();
    dailyDiff = sma(rawDiff, 3);

    const ranges = { "1M": 30, "3M": 90, "6M": 180, "1Y": 365, "All": Infinity };
    const days = ranges[lastRangeKey] || Infinity;
    const max = timestamps[timestamps.length - 1];
    const min = days === Infinity ? timestamps[0] : max - days * 86400;
    let startIdx = 0;
    for (let i = 0; i < timestamps.length; i++) {
      if (timestamps[i] >= min) { startIdx = i; break; }
    }
    currentCumulative = buildCumulative(startIdx);
    cumChart.setData([timestamps, currentCumulative], false);
    updateAnnotation(currentCumulative, currentRangeLabel);
  }

  // Respond to fuel selection — recompute cumulative spread
  fuelState.on(() => recomputeCumulative());

  // Chart D: Daily % change overlay — dual Y-axes, smoothing, outlier clamping
  const SMA_WINDOW = 5;
  const CLAMP_LIMIT = 8; // cap extreme spikes at ±8%
  const LAG_OPTIONS = [0, 3, 5, 7, 10];
  let currentLag = 0;

  /** Shift array forward by N positions (prepend nulls, trim end). */
  function shiftForward(arr, n) {
    if (n === 0) return arr;
    const out = new Array(arr.length).fill(null);
    for (let i = n; i < arr.length; i++) {
      out[i] = arr[i - n];
    }
    return out;
  }

  function buildFuelData() {
    const raw = clamp(activeFuelPct(), CLAMP_LIMIT);
    return { raw, smooth: sma(raw, SMA_WINDOW) };
  }

  function buildCrudeData() {
    const base = clamp(activeBrentPct(), CLAMP_LIMIT);
    const shifted = shiftForward(base, currentLag);
    return { raw: shifted, smooth: sma(shifted, SMA_WINDOW) };
  }

  let fuelData = buildFuelData();
  let crudeData = buildCrudeData();

  // Start with smoothed data
  let isSmoothed = true;

  const pctOpts = {
    ...baseOpts(null),
    scales: {
      x: { time: true },
      fuel: { auto: true },
      crude: { auto: true },
    },
    series: [
      {},
      {
        label: "Αμόλυβδη 95",
        stroke: COLORS.unleaded95,
        width: 2.5,
        scale: "fuel",
      },
      {
        label: "Brent Crude",
        stroke: COLORS.brent + "88", // ~0.53 opacity — visually secondary
        width: 1,
        scale: "crude",
      },
    ],
    axes: [
      baseOpts(null).axes[0],
      {
        ...baseOpts(null).axes[1],
        scale: "fuel",
        stroke: COLORS.unleaded95 + "99",
        grid: { stroke: COLORS.unleaded95 + "0e", width: 1 },
        ticks: { stroke: COLORS.unleaded95 + "33", width: 1 },
        values: (u, vals) => vals.map((v) => v != null ? `${v.toFixed(1)}%` : ""),
      },
      {
        ...baseOpts(null).axes[1],
        scale: "crude",
        side: 1,
        stroke: COLORS.brent + "99",
        grid: { show: false },
        ticks: { stroke: COLORS.brent + "33", width: 1 },
        values: (u, vals) => vals.map((v) => v != null ? `${v.toFixed(1)}%` : ""),
      },
    ],
    plugins: [dailyPctTooltipPlugin()],
  };

  // Custom tooltip for daily chart — shows both values + their difference
  function dailyPctTooltipPlugin() {
    let tooltipEl;

    function init(u) {
      tooltipEl = document.createElement("div");
      tooltipEl.className = "fuel-tooltip";
      tooltipEl.style.display = "none";
      u.over.appendChild(tooltipEl);
    }

    function setCursor(u) {
      const { idx } = u.cursor;
      if (idx == null) { tooltipEl.style.display = "none"; return; }

      const ts = u.data[0][idx];
      const fuelVal = u.data[1][idx];
      const brentVal = u.data[2][idx];
      const diff = (fuelVal != null && brentVal != null)
        ? Math.round((fuelVal - brentVal) * 1000) / 1000
        : null;

      let html = `<div class="fuel-tooltip-date">${fmtDate(ts)}</div>`;
      if (fuelVal != null) {
        html += `<div class="fuel-tooltip-row">
          <span class="fuel-tooltip-swatch" style="background:${COLORS.unleaded95}"></span>
          ${FUEL_TYPES[fuelState.key].fullLabel}: <strong>${fmtPct(fuelVal)}</strong>
        </div>`;
      }
      if (brentVal != null) {
        html += `<div class="fuel-tooltip-row">
          <span class="fuel-tooltip-swatch" style="background:${COLORS.brent}"></span>
          Brent: <strong>${fmtPct(brentVal)}</strong>
        </div>`;
      }
      if (diff != null) {
        const diffColor = diff >= 0 ? COLORS.spread : COLORS.brent;
        html += `<div class="fuel-tooltip-row" style="border-top:1px solid #eee;padding-top:3px;margin-top:3px">
          <span class="fuel-tooltip-swatch" style="background:${diffColor}"></span>
          Διαφορά: <strong>${fmtPct(diff)}</strong>
        </div>`;
      }

      tooltipEl.innerHTML = html;
      tooltipEl.style.display = "block";

      const { left, top } = u.cursor;
      const overRect = u.over.getBoundingClientRect();
      const ttRect = tooltipEl.getBoundingClientRect();
      let x = left + 15;
      let y = top - 10;
      if (x + ttRect.width > overRect.width) x = left - ttRect.width - 15;
      if (y + ttRect.height > overRect.height) y = overRect.height - ttRect.height - 5;
      if (y < 0) y = 5;
      tooltipEl.style.left = x + "px";
      tooltipEl.style.top = y + "px";
    }

    return { hooks: { init: [init], setCursor: [setCursor] } };
  }

  const pctChart = mountChart(
    "chart-daily-pct",
    pctOpts,
    [timestamps, fuelData.smooth, crudeData.smooth],
    "1M",
  );

  if (pctChart) {
    const container = document.getElementById("chart-daily-pct");

    // Series toggles
    createSeriesToggle(container, pctChart, [
      { label: "Αμόλυβδη 95", color: COLORS.unleaded95, seriesIdx: 1 },
      { label: "Brent Crude", color: COLORS.brent, seriesIdx: 2 },
    ]);

    // Smoothing toggle
    const smoothBtn = document.createElement("button");
    smoothBtn.className = "fuel-toggle fuel-toggle--smooth";
    smoothBtn.textContent = "Ημερήσια δεδομένα";
    smoothBtn.style.borderColor = "#888";
    smoothBtn.style.color = "#888";
    smoothBtn.classList.add("off");

    smoothBtn.addEventListener("click", () => {
      isSmoothed = !isSmoothed;
      smoothBtn.classList.toggle("off", isSmoothed);
      pctChart.setData([
        timestamps,
        isSmoothed ? fuelData.smooth : fuelData.raw,
        isSmoothed ? crudeData.smooth : crudeData.raw,
      ]);
    });

    // Respond to FX toggle
    fxState.on(() => {
      crudeData = buildCrudeData();
      pctChart.setData([
        timestamps,
        isSmoothed ? fuelData.smooth : fuelData.raw,
        isSmoothed ? crudeData.smooth : crudeData.raw,
      ]);
    });

    // Respond to fuel selection
    fuelState.on(() => {
      fuelData = buildFuelData();
      crudeData = buildCrudeData();
      const xMin = pctChart.scales.x.min;
      const xMax = pctChart.scales.x.max;
      pctChart.setData([
        timestamps,
        isSmoothed ? fuelData.smooth : fuelData.raw,
        isSmoothed ? crudeData.smooth : crudeData.raw,
      ], false);
      pctChart.setScale("x", { min: xMin, max: xMax });
    });

    // Append to the toggles row
    const togglesRow = container.querySelector(".fuel-toggles");
    if (togglesRow) {
      togglesRow.appendChild(smoothBtn);
    }

    // Lag control — compact pill row
    const lagWrap = document.createElement("div");
    lagWrap.className = "fuel-lag-control";

    const lagLabel = document.createElement("span");
    lagLabel.className = "fuel-lag-label";
    lagLabel.textContent = "Καθυστέρηση:";
    lagWrap.appendChild(lagLabel);

    const lagBtns = {};
    for (const lag of LAG_OPTIONS) {
      const btn = document.createElement("button");
      btn.className = "fuel-lag-btn" + (lag === 0 ? " active" : "");
      btn.textContent = lag === 0 ? "0" : `${lag}η`;
      btn.addEventListener("click", () => {
        currentLag = lag;
        Object.values(lagBtns).forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        crudeData = buildCrudeData();

        // Preserve current x-axis range
        const xMin = pctChart.scales.x.min;
        const xMax = pctChart.scales.x.max;
        pctChart.setData([
          timestamps,
          isSmoothed ? fuelData.smooth : fuelData.raw,
          isSmoothed ? crudeData.smooth : crudeData.raw,
        ], false);
        pctChart.setScale("x", { min: xMin, max: xMax });
      });
      lagWrap.appendChild(btn);
      lagBtns[lag] = btn;
    }

    container.appendChild(lagWrap);
  }
}

// ---- Section 5: EU Comparison Chart ----

const EU_COUNTRIES = {
  GR: { label: "Ελλάδα", color: COLORS.unleaded95, width: 2.5 },
  EU: { label: "Μ.Ο. ΕΕ", color: COLORS.diesel, width: 1.5 },
  IT: { label: "Ιταλία", color: COLORS.unleaded100, width: 1 },
  BG: { label: "Βουλγαρία", color: COLORS.autogas, width: 1 },
  RO: { label: "Ρουμανία", color: COLORS.romania, width: 1 },
};

function renderEUComparison(data) {
  const eu = data.eu_comparison;
  if (!eu) return;

  const container = document.getElementById("chart-eu-comparison");
  if (!container) return;

  const titleEl = document.getElementById("eu-chart-title");

  // Map fuel state to EU fuel key
  function euFuelKey() {
    const key = fuelState.key;
    if (key === "unleaded_95" || key === "unleaded_100") return "euro95";
    if (key === "diesel") return "diesel";
    return null;
  }

  // Track which countries are visible
  const visible = { GR: true, EU: true, IT: true, BG: true, RO: false };

  function buildChartData(fuelKey) {
    if (!fuelKey) return null;

    const seriesData = [eu.timestamps];
    const seriesOpts = [{}];

    for (const [cc, cfg] of Object.entries(EU_COUNTRIES)) {
      const key = `${cc.toLowerCase()}_${fuelKey}`;
      const arr = eu.series[key] || [];
      // If hidden, pass nulls so uPlot keeps series indices stable
      seriesData.push(visible[cc] ? arr : arr.map(() => null));
      seriesOpts.push({
        label: cfg.label,
        stroke: visible[cc] ? cfg.color : "transparent",
        width: cfg.width,
        show: visible[cc],
      });
    }

    return { seriesData, seriesOpts };
  }

  function buildTooltipPlugin() {
    let tooltipEl;

    function init(u) {
      tooltipEl = document.createElement("div");
      tooltipEl.className = "fuel-tooltip";
      tooltipEl.style.display = "none";
      u.over.appendChild(tooltipEl);
    }

    function setCursor(u) {
      const { idx } = u.cursor;
      if (idx == null) { tooltipEl.style.display = "none"; return; }

      const ts = u.data[0][idx];
      let html = `<div class="fuel-tooltip-date">${fmtDate(ts)}</div>`;

      const countries = Object.entries(EU_COUNTRIES);
      for (let s = 0; s < countries.length; s++) {
        const [cc, cfg] = countries[s];
        if (!visible[cc]) continue;
        const val = u.data[s + 1]?.[idx];
        if (val == null) continue;
        html += `<div class="fuel-tooltip-row">
          <span class="fuel-tooltip-swatch" style="background:${cfg.color}"></span>
          ${cfg.label}: <strong>€${fmtEUR(val)}</strong>
        </div>`;
      }

      tooltipEl.innerHTML = html;
      tooltipEl.style.display = "block";

      const { left, top } = u.cursor;
      const overRect = u.over.getBoundingClientRect();
      const ttRect = tooltipEl.getBoundingClientRect();
      let x = left + 15;
      let y = top - 10;
      if (x + ttRect.width > overRect.width) x = left - ttRect.width - 15;
      if (y + ttRect.height > overRect.height) y = overRect.height - ttRect.height - 5;
      if (y < 0) y = 5;
      tooltipEl.style.left = x + "px";
      tooltipEl.style.top = y + "px";
    }

    return { hooks: { init: [init], setCursor: [setCursor] } };
  }

  function buildOpts(seriesOpts) {
    return {
      ...baseOpts(null),
      series: seriesOpts,
      axes: [
        baseOpts(null).axes[0],
        {
          ...baseOpts(null).axes[1],
          values: (u, vals) => vals.map((v) => v != null ? fmtEUR(v) : ""),
        },
      ],
      plugins: [buildTooltipPlugin()],
    };
  }

  let currentFuelKey = euFuelKey() || "euro95";
  let chartResult = buildChartData(currentFuelKey);

  if (!chartResult) return;

  // Mount chart
  let euChart = mountChart(
    "chart-eu-comparison",
    buildOpts(chartResult.seriesOpts),
    chartResult.seriesData,
    "1Y",
  );

  function updateTitle() {
    if (!titleEl) return;
    const fk = currentFuelKey;
    titleEl.textContent = fk === "euro95"
      ? "Αμόλυβδη 95 (EUR/λίτρο)"
      : "Diesel (EUR/λίτρο)";
  }
  updateTitle();

  // Country toggle pills
  const toggleItems = Object.entries(EU_COUNTRIES).map(([cc, cfg]) => ({
    label: cfg.label,
    color: cfg.color,
    cc,
  }));

  const toggleWrap = document.createElement("div");
  toggleWrap.className = "fuel-toggles";

  const countryBtns = {};
  for (const { label, color, cc } of toggleItems) {
    const btn = document.createElement("button");
    btn.className = "fuel-toggle" + (visible[cc] ? "" : " off");
    btn.textContent = label;
    btn.style.borderColor = color;
    btn.style.color = color;

    if (cc === "GR") {
      // Greece is always pinned
      btn.style.cursor = "default";
      btn.style.fontWeight = "700";
    } else {
      btn.addEventListener("click", () => {
        visible[cc] = !visible[cc];
        btn.classList.toggle("off", !visible[cc]);
        rebuildChart();
      });
    }

    toggleWrap.appendChild(btn);
    countryBtns[cc] = btn;
  }

  container.prepend(toggleWrap);

  function rebuildChart() {
    chartResult = buildChartData(currentFuelKey);
    if (!chartResult) return;

    // Preserve range
    const xMin = euChart?.scales?.x?.min;
    const xMax = euChart?.scales?.x?.max;

    container.querySelector(".uplot")?.remove();
    container.querySelector(".fuel-range-btns")?.remove();

    const opts = buildOpts(chartResult.seriesOpts);
    const { width, height } = responsiveSize(container);
    opts.width = width;
    opts.height = height;

    euChart = new uPlot(opts, chartResult.seriesData, container);

    const ro = new ResizeObserver(() => {
      euChart.setSize(responsiveSize(container));
    });
    ro.observe(container);

    createRangeButtons(container, euChart, eu.timestamps, "1Y");

    euChart.over.addEventListener("dblclick", () => {
      euChart.setScale("x", {
        min: eu.timestamps[0],
        max: eu.timestamps[eu.timestamps.length - 1],
      });
    });

    if (xMin != null && xMax != null) {
      euChart.setScale("x", { min: xMin, max: xMax });
    }

    updateTitle();
  }

  // Respond to fuel selector
  fuelState.on((key) => {
    const fk = euFuelKey();
    if (fk && fk !== currentFuelKey) {
      currentFuelKey = fk;
      rebuildChart();
    }
  });
}

// ---- Main ----

async function main() {
  try {
    const data = await fetchJSON(DATA_URL, DATA_FALLBACK);
    renderPriceCards(data);
    renderHistoryCharts(data);
    renderAnalysisCharts(data);
    renderEUComparison(data);
  } catch (err) {
    console.error("Failed to load fuel data:", err);
    document.querySelectorAll(".fuel-chart-skeleton").forEach((el) => {
      el.className = "fuel-chart-error";
      el.textContent = "Δεν ήταν δυνατή η φόρτωση δεδομένων. Δοκιμάστε ξανά αργότερα.";
    });
  }
}

main();
