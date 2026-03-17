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

const DATA_URL = "/assets/data/fuel-chart.json";

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

// ---- Section 2: Price History Charts ----

function renderHistoryCharts(data) {
  const { timestamps, unleaded_95, brent } = data.series;

  // Chart A: Unleaded 95
  const optsU95 = {
    ...baseOpts(null),
    series: [
      {},
      {
        label: "Αμόλυβδη 95",
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

  mountChart("chart-unleaded95", optsU95, [timestamps, unleaded_95], "1Y");

  // Chart B: Brent
  const optsBrent = {
    ...baseOpts(null),
    series: [
      {},
      {
        label: "Brent Crude",
        stroke: COLORS.brent,
        width: 1.5,
        fill: COLORS.brent + "14",
      },
    ],
    axes: [
      baseOpts(null).axes[0],
      {
        ...baseOpts(null).axes[1],
        values: (u, vals) => vals.map((v) => v != null ? `$${v.toFixed(0)}` : ""),
      },
    ],
    plugins: [
      tooltipPlugin([(v) => fmtUSD(v)], [COLORS.brent]),
    ],
  };

  mountChart("chart-brent", optsBrent, [timestamps, brent], "1Y");
}

// ---- Section 3: Analysis Charts ----

function renderAnalysisCharts(data) {
  const { timestamps, cumulative_spread, pct_unleaded_95, pct_brent } = data.series;

  // Chart C: Cumulative spread — recomputed per range, reset to 0 at range start
  const SPREAD_CLAMP = 10;
  const clampedFuelPct = clamp(pct_unleaded_95, SPREAD_CLAMP);
  const clampedBrentPct = clamp(pct_brent, SPREAD_CLAMP);

  // Compute daily diff (fuel pct - brent pct), light 3-day smoothing
  const rawDiff = clampedFuelPct.map((f, i) => {
    const b = clampedBrentPct[i];
    if (f == null || b == null) return null;
    return Math.round((f - b) * 1000) / 1000;
  });
  const dailyDiff = sma(rawDiff, 3); // light smoothing reduces harsh edges

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
  createRangeButtons(container, cumChart, timestamps, "1Y", (key, min, max) => {
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

  // Chart D: Daily % change overlay — dual Y-axes, smoothing, outlier clamping
  const SMA_WINDOW = 5;
  const CLAMP_LIMIT = 8; // cap extreme spikes at ±8%

  const rawFuel = clamp(pct_unleaded_95, CLAMP_LIMIT);
  const rawCrude = clamp(pct_brent, CLAMP_LIMIT);
  const smoothFuel = sma(rawFuel, SMA_WINDOW);
  const smoothCrude = sma(rawCrude, SMA_WINDOW);

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
          Αμόλυβδη 95: <strong>${fmtPct(fuelVal)}</strong>
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
    [timestamps, smoothFuel, smoothCrude],
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
        isSmoothed ? smoothFuel : rawFuel,
        isSmoothed ? smoothCrude : rawCrude,
      ]);
    });

    // Append to the toggles row
    const togglesRow = container.querySelector(".fuel-toggles");
    if (togglesRow) {
      togglesRow.appendChild(smoothBtn);
    }
  }
}

// ---- Main ----

async function main() {
  try {
    const data = await fetchJSON(DATA_URL);
    renderPriceCards(data);
    renderHistoryCharts(data);
    renderAnalysisCharts(data);
  } catch (err) {
    console.error("Failed to load fuel data:", err);
    document.querySelectorAll(".fuel-chart-skeleton").forEach((el) => {
      el.className = "fuel-chart-error";
      el.textContent = "Δεν ήταν δυνατή η φόρτωση δεδομένων. Δοκιμάστε ξανά αργότερα.";
    });
  }
}

main();
