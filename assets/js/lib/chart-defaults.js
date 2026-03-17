/** Shared uPlot defaults, color palette, and responsive sizing. */

export const COLORS = {
  unleaded95: "#e63946",
  unleaded100: "#f4a261",
  diesel: "#457b9d",
  autogas: "#6a994e",
  brent: "#2a9d8f",
  spread: "#e76f51",
  avgLine: "#999",
};

/** Calculate responsive chart dimensions from a container element. */
export function responsiveSize(containerEl) {
  const w = containerEl.clientWidth;
  const h = w < 640 ? Math.round(w * 0.7) : Math.round(w * 0.45);
  return { width: w, height: h };
}

/** Return a base uPlot options object. Caller extends with series, scales, etc. */
export function baseOpts(title) {
  return {
    title,
    cursor: {
      drag: { x: true, y: false, uni: 50 },
      sync: { key: "fuel" },
    },
    scales: {
      x: { time: true },
    },
    axes: [
      {
        stroke: "#666",
        grid: { stroke: "#eee", width: 1 },
        ticks: { stroke: "#ccc", width: 1 },
        font: "11px -apple-system, system-ui, sans-serif",
      },
      {
        stroke: "#666",
        grid: { stroke: "#eee", width: 1 },
        ticks: { stroke: "#ccc", width: 1 },
        size: 55,
        font: "11px -apple-system, system-ui, sans-serif",
      },
    ],
    legend: { show: false },
    // Disable scroll-wheel zoom — prevents accidental zoom while scrolling page
    hooks: {
      init: [
        (u) => {
          u.over.addEventListener("wheel", (e) => e.preventDefault(), {
            passive: false,
          });
        },
      ],
    },
  };
}

/**
 * Create range preset buttons for a chart.
 * @param {HTMLElement} container - element to append buttons into
 * @param {uPlot} chart - the uPlot instance
 * @param {number[]} timestamps - full timestamps array
 * @param {string} defaultRange - initial active range key
 * @returns {function} setRange - call with a range key to programmatically switch
 */
export function createRangeButtons(container, chart, timestamps, defaultRange = "1Y", onChange) {
  const ranges = {
    "1M": 30,
    "3M": 90,
    "6M": 180,
    "1Y": 365,
    "All": Infinity,
  };

  const btnGroup = document.createElement("div");
  btnGroup.className = "fuel-range-btns";

  const buttons = {};

  function setRange(key) {
    const days = ranges[key];
    const max = timestamps[timestamps.length - 1];
    const min = days === Infinity
      ? timestamps[0]
      : max - days * 86400;

    chart.setScale("x", { min, max });

    Object.values(buttons).forEach((b) => b.classList.remove("active"));
    buttons[key]?.classList.add("active");

    if (onChange) onChange(key, min, max);
  }

  for (const key of Object.keys(ranges)) {
    const btn = document.createElement("button");
    btn.className = "fuel-range-btn";
    btn.textContent = key === "1Y" ? "1E" : key === "All" ? "Όλα" : key;
    btn.addEventListener("click", () => setRange(key));
    btnGroup.appendChild(btn);
    buttons[key] = btn;
  }

  container.prepend(btnGroup);
  // Set default after a tick so chart is mounted
  setTimeout(() => setRange(defaultRange), 0);

  return setRange;
}

/**
 * Create toggle buttons for showing/hiding chart series.
 * @param {HTMLElement} container - element to prepend buttons into
 * @param {uPlot} chart - the uPlot instance
 * @param {Array<{label: string, color: string, seriesIdx: number}>} items
 */
export function createSeriesToggle(container, chart, items) {
  const wrap = document.createElement("div");
  wrap.className = "fuel-toggles";

  for (const { label, color, seriesIdx } of items) {
    const btn = document.createElement("button");
    btn.className = "fuel-toggle";
    btn.textContent = label;
    btn.style.borderColor = color;
    btn.style.color = color;

    btn.addEventListener("click", () => {
      const visible = chart.series[seriesIdx].show;
      chart.setSeries(seriesIdx, { show: !visible });
      btn.classList.toggle("off", visible);
    });

    wrap.appendChild(btn);
  }

  container.prepend(wrap);
}
