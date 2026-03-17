/** Custom tooltip factory for uPlot charts. */

import { fmtDate } from "./format.js";

/**
 * Create a tooltip plugin for uPlot.
 * @param {function[]} formatters - array of formatter functions, one per series (index 0 = x axis, skipped)
 * @param {string[]} colors - array of colors matching series
 * @returns {object} uPlot plugin (hooks)
 */
export function tooltipPlugin(formatters, colors) {
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
      return;
    }

    const ts = u.data[0][idx];
    let html = `<div class="fuel-tooltip-date">${fmtDate(ts)}</div>`;

    for (let i = 1; i < u.series.length; i++) {
      if (!u.series[i].show) continue;
      const val = u.data[i][idx];
      const label = u.series[i].label || "";
      const color = colors[i - 1] || "#666";
      const formatted = formatters[i - 1] ? formatters[i - 1](val) : val;

      html += `<div class="fuel-tooltip-row">
        <span class="fuel-tooltip-swatch" style="background:${color}"></span>
        ${label}: <strong>${formatted}</strong>
      </div>`;
    }

    tooltipEl.innerHTML = html;
    tooltipEl.style.display = "block";

    // Position tooltip near cursor but keep it within chart bounds
    const { left, top } = u.cursor;
    const overRect = u.over.getBoundingClientRect();
    const ttRect = tooltipEl.getBoundingClientRect();

    let x = left + 15;
    let y = top - 10;

    // Flip if too close to right edge
    if (x + ttRect.width > overRect.width) {
      x = left - ttRect.width - 15;
    }
    // Keep above bottom edge
    if (y + ttRect.height > overRect.height) {
      y = overRect.height - ttRect.height - 5;
    }
    if (y < 0) y = 5;

    tooltipEl.style.left = x + "px";
    tooltipEl.style.top = y + "px";
  }

  return {
    hooks: {
      init: [init],
      setCursor: [setCursor],
    },
  };
}
