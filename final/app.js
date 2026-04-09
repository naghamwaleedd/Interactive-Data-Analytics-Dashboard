(function () { 
  //updated
  if ('scrollRestoration' in history) {
    try { history.scrollRestoration = 'manual'; } catch (e) {}
  }
  const timeFromEl = document.getElementById('timeFrom');
  const timeToEl = document.getElementById('timeTo');
  const dateFromEl = document.getElementById('dateFrom');
  const dateToEl = document.getElementById('dateTo');
  const applyBtn = document.getElementById('applyBtn');
  const rangeLabel1 = document.getElementById('rangeLabel1');
  const rangeLabel2 = document.getElementById('rangeLabel2');
  const yearEl = document.getElementById('year');

  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 6);

  // Set footer year immediately
  yearEl.textContent = String(today.getFullYear());

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour12: false });
  }

  // Prepare default times but defer assignment until init to avoid browser clearing
  function pad2(n) { return String(n).padStart(2, '0'); }
  const defaultTimeFrom = `${pad2(0)}:${pad2(0)}`;
  const defaultTimeTo = `${pad2(23)}:${pad2(59)}`;

  function formatRangeLabel(fromDate, toDate) {
    const opts = { month: 'short', day: '2-digit', year: 'numeric' };
    const f = fromDate.toLocaleDateString(undefined, opts);
    const t = toDate.toLocaleDateString(undefined, opts);
    return `${f} → ${t}`;
  }

  // Set this to false when you connect real data
  const USE_SAMPLE_DATA = true;

  function seededRandomFactory(seed) {
    let _seed = seed >>> 0;
    return function rand() {
      _seed = (_seed * 1664525 + 1013904223) >>> 0; // LCG
      return _seed / 4294967296; // [0,1)
    };
  }

  // Generate dataset: one data point per day for last 120 days
  const historicalData = (() => {
    const points = [];
    const base = new Date();
    const rand = USE_SAMPLE_DATA ? seededRandomFactory(42) : Math.random;
    for (let i = 0; i < 120; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      d.setHours(0, 0, 0, 0);
      // Create synthetic day data: sentiment counts and keyword frequencies
      const good = Math.max(0, Math.round(20 + Math.sin(i / 5) * 8 + (rand() * 8 - 4)));
      const neutral = Math.max(0, Math.round(15 + Math.cos(i / 7) * 6 + (rand() * 6 - 3)));
      const bad = Math.max(0, Math.round(10 + Math.sin(i / 9) * 5 + (rand() * 6 - 3)));
      const keywords = generateKeywordCounts(i, rand);
      points.push({ date: d, sentiment: { good, neutral, bad }, keywords });
    }
    return points.sort((a, b) => a.date - b.date);
  })();

  const SENTIMENT_LABELS = ['Good', 'Neutral', 'Bad'];
  const SENTIMENT_COLORS = ['#39d98a', '#aab2d5', '#ff6b6b'];

  function generateKeywordCounts(dayIndex, rand = Math.random) {
    // sample keywords; rotate weights to vary over time
    const keys = ['delivery', 'price', 'quality', 'support', 'refund', 'new', 'delay'];
    const counts = {};
    keys.forEach((k, idx) => {
      const base = 8 - (idx % 4);
      const wobble = Math.abs(Math.sin((dayIndex + idx) / 3)) * 6;
      counts[k] = Math.max(0, Math.round(base + wobble + (rand() * 4 - 2)));
    });
    return counts;
  }

  function filterDataByDateRange(fromDate, toDate) {
    const f = new Date(fromDate);
    const t = new Date(toDate);
    // apply selected times
    const [fh, fm] = timeFromEl.value.split(':').map(Number);
    const [th, tm] = timeToEl.value.split(':').map(Number);
    f.setHours(fh || 0, fm || 0, 0, 0);
    t.setHours(th ?? 23, tm ?? 59, 59, 999);
    return historicalData.filter(p => p.date >= f && p.date <= t);
  }

  let salesChart;
  let ordersChart;

  function generateColors(count) {
    // Purple shades palette
    const base = [
      '#7c4dff', '#9b6cff', '#b189ff', '#c3a2ff', '#d5bbff', '#e6d3ff', '#f0e6ff'
    ];
    if (count <= base.length) return base.slice(0, count);
    const colors = base.slice();
    while (colors.length < count) {
      colors.push('#7c4dff');
    }
    return colors;
  }

  function ensureCharts(ctx1, ctx2) {
    const c1 = ctx1 && ctx1.getContext ? ctx1.getContext('2d') : ctx1;
    const c2 = ctx2 && ctx2.getContext ? ctx2.getContext('2d') : ctx2;
    // Optionally register datalabels plugin if present
    if (typeof Chart !== 'undefined' && typeof Chart.register === 'function' && typeof window.ChartDataLabels !== 'undefined') {
      try { Chart.register(window.ChartDataLabels); } catch (e) {}
    }
    if (c1 && !salesChart) {
      salesChart = new Chart(c1, {
        type: 'pie',
        data: { labels: [], datasets: [{ label: 'Sentiment', data: [], backgroundColor: ['#39d98a', '#aab2d5', '#ff6b6b'], borderColor: '#fff', borderWidth: 2, hoverOffset: 15 }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 0 },
          plugins: {
            legend: { display: true, position: 'bottom' },
            tooltip: {
              callbacks: {
                label: function(ctx) {
                  const label = ctx.label || '';
                  const value = ctx.raw ?? 0;
                  return `${label}: ${value}%`;
                }
              }
            },
            datalabels: typeof window.ChartDataLabels !== 'undefined' ? {
              color: '#fff',
              font: { weight: 'bold' },
              formatter: (value) => `${value}%`
            } : undefined
          }
        }
      });
    }
    if (c2 && !ordersChart) {
      ordersChart = new Chart(c2, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Keywords', data: [], backgroundColor: '#6ea8ff', borderRadius: 6, maxBarThickness: 28 }] },
        options: barChartOptions()
      });
    }
  }

  function getSentimentColorsByLabels(labels) {
    const colorMap = {
      good: '#39d98a',
      neutral: '#aab2d5',
      bad: '#ff6b6b'
    };
    return labels.map(l => colorMap[String(l || '').toLowerCase()] || '#9b6cff');
  }

  function fetchSentimentFromApi(fromStr, toStr) {
    const baseUrl = 'https://localhost:7032/api/Sentiment/GetSentiment';
    const buildUrl = () => {
      const u = new URL(baseUrl);
      u.searchParams.set('from', fromStr);
      u.searchParams.set('to', toStr);
      return u.toString();
    };
    if (typeof fetch === 'function') {
      return fetch(buildUrl(), { method: 'GET', cache: 'no-store' })
        .then(res => res.ok ? res.json() : Promise.reject(new Error('HTTP ' + res.status)))
        .then(body => {
          if (body && Array.isArray(body.data) && body.returncode === 200) {
            const labels = body.data.map(r => r.sentimentkey ?? r.SentimentKey ?? r.label);
            const data = body.data.map(r => {
              const v = r.sentimentperc ?? r.SentimentPerc ?? r.value ?? r.count;
              const num = Number(v);
              return Number.isFinite(num) ? num : 0;
            });
            return { labels, data };
          }
          if (body && body.returncode === 404) {
            return { labels: ['Good', 'Neutral', 'Bad'], data: [0, 0, 0] };
          }
          const msg = body?.returnDescription || 'Unexpected API response';
          throw new Error(msg);
        });
    }
    if (typeof $ !== 'undefined' && $.ajax) {
      return new Promise((resolve, reject) => {
        $.ajax({
          url: baseUrl,
          type: 'GET',
          data: { from: fromStr, to: toStr },
          cache: false,
          success: function (body) {
            if (body && Array.isArray(body.data) && body.returncode === 200) {
              const labels = body.data.map(r => r.sentimentkey ?? r.SentimentKey ?? r.label);
              const data = body.data.map(r => {
                const v = r.sentimentperc ?? r.SentimentPerc ?? r.value ?? r.count;
                const num = Number(v);
                return Number.isFinite(num) ? num : 0;
              });
              resolve({ labels, data });
            } else if (body && body.returncode === 404) {
              resolve({ labels: ['Good', 'Neutral', 'Bad'], data: [0, 0, 0] });
            } else {
              const msg = body?.returnDescription || 'Unexpected API response';
              reject(new Error(msg));
            }
          },
          error: function (xhr, status, err) {
            reject(new Error(err || status || 'Request failed'));
          }
        });
      });
    }
    return Promise.reject(new Error('No HTTP client available'));
  }

  function baseChartOptions(title) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      plugins: {
        legend: { display: true, position: 'right', labels: { color: '#aab2d5', usePointStyle: true, boxWidth: 10 } },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(ctx) {
              const ds = ctx.dataset;
              const total = ds.data.reduce((a, b) => a + b, 0) || 1;
              const value = ctx.raw || 0;
              const pct = Math.round((value / total) * 100);
              const label = ctx.label?.replace(/\s*\(.*?\)$/, '') || '';
              return `${label}: ${value} (${pct}%)`;
            }
          }
        }
      },
      // no scales for pie charts
    };
  }

  function barChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#aab2d5' } },
        y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#aab2d5' }, beginAtZero: true }
      }
    };
  }

  function setRangeLabels(fromDate, toDate) {
    rangeLabel1.textContent = formatRangeLabel(fromDate, toDate);
    rangeLabel2.textContent = rangeLabel1.textContent;
  }

  function getNormalizedRange() {
    let fromVal = dateFromEl.value;
    let toVal = dateToEl.value;
    if (!fromVal || !toVal) {
      dateFromEl.valueAsDate = new Date(sevenDaysAgo);
      dateToEl.valueAsDate = new Date(today);
      fromVal = dateFromEl.value;
      toVal = dateToEl.value;
    }
    let fromDate = new Date(fromVal);
    let toDate = new Date(toVal);
    if (fromDate > toDate) {
      const tmp = new Date(fromDate);
      dateFromEl.valueAsDate = toDate;
      dateToEl.valueAsDate = tmp;
      fromVal = dateFromEl.value;
      toVal = dateToEl.value;
      fromDate = new Date(fromVal);
      toDate = new Date(toVal);
    }
    setRangeLabels(fromDate, toDate);
    return { fromVal, toVal, fromDate, toDate };
  }

  function updatePieChart() {
    const { fromIso, toIso } = (function(){
      const { fromVal, toVal } = getNormalizedRange();
      const [fh, fm] = (timeFromEl.value || '00:00').split(':');
      const [th, tm] = (timeToEl.value || '23:59').split(':');
      return {
        fromIso: `${fromVal}T${String(fh).padStart(2, '0')}:${String(fm).padStart(2, '0')}`,
        toIso: `${toVal}T${String(th).padStart(2, '0')}:${String(tm).padStart(2, '0')}`
      };
    })();
    if (!salesChart) return;
    fetchSentimentFromApi(fromIso, toIso)
      .then(({ labels, data }) => {
        // Fallback to defaults if API returns empty/invalid arrays
        let useLabels = Array.isArray(labels) && labels.length ? labels : ['Good', 'Neutral', 'Bad'];
        let useData = Array.isArray(data) && data.length ? data.map(v => Number(v) || 0) : [0, 0, 0];
        const fixed = { good: '#2ecc71', bad: '#e74c3c', neutral: '#6c757d' };
        const colors = useLabels.map(l => fixed[String(l || '').toLowerCase()] || '#bdc3c7');
        const { render, display } = normalizePieDataForRendering(useData);
        salesChart.data.labels = useLabels;
        salesChart.data.datasets[0].data = render;
        salesChart.data.datasets[0].backgroundColor = colors;
        // Ensure legend and tooltip
        salesChart.options.plugins = salesChart.options.plugins || {};
        salesChart.options.plugins.legend = salesChart.options.plugins.legend || { display: true, position: 'right' };
        salesChart.options.plugins.tooltip = salesChart.options.plugins.tooltip || {};
        salesChart.options.plugins.tooltip.callbacks = salesChart.options.plugins.tooltip.callbacks || {};
        salesChart.options.plugins.tooltip.callbacks.label = function(ctx) {
          const label = ctx.label || '';
          const idx = ctx.dataIndex || 0;
          const original = display[idx] ?? 0;
          return `${label}: ${original}%`;
        };
        salesChart.update();
      })
      .catch((err) => {
        console.warn('Sentiment API failed:', err?.message || err);
        if (salesChart) {
          const labels = ['Good', 'Neutral', 'Bad'];
          const colors = ['#2ecc71', '#6c757d', '#e74c3c'];
          const { render, display } = normalizePieDataForRendering([0,0,0]);
          salesChart.data.labels = labels;
          salesChart.data.datasets[0].data = render;
          salesChart.data.datasets[0].backgroundColor = colors;
          salesChart.options.plugins = salesChart.options.plugins || {};
          salesChart.options.plugins.legend = salesChart.options.plugins.legend || { display: true, position: 'right' };
          salesChart.options.plugins.tooltip = salesChart.options.plugins.tooltip || {};
          salesChart.options.plugins.tooltip.callbacks = salesChart.options.plugins.tooltip.callbacks || {};
          salesChart.options.plugins.tooltip.callbacks.label = function(ctx) {
            const label = ctx.label || '';
            const idx = ctx.dataIndex || 0;
            const original = display[idx] ?? 0;
            return `${label}: ${original}%`;
          };
          salesChart.update();
        }
        const ctx1 = document.getElementById('salesChart');
        if (ctx1 && !ctx1.nextSibling?.classList?.contains?.('chart-warn')) {
          ctx1.insertAdjacentHTML('afterend', `<div class="chart-warn" style="color:#ff6b6b;font-size:12px;margin-top:6px;">Failed to load sentiment data</div>`);
        }
      });
  }

  function updateBarChart() {
    const { fromDate, toDate } = getNormalizedRange();
    let filtered = filterDataByDateRange(fromDate, toDate);
    if (!filtered.length) {
      filtered = historicalData.slice(-14);
    }
    const keywordTotals = {};
    filtered.forEach(p => {
      Object.entries(p.keywords).forEach(([k, v]) => {
        keywordTotals[k] = (keywordTotals[k] || 0) + v;
      });
    });
    const keywordEntries = Object.entries(keywordTotals).sort((a, b) => b[1] - a[1]);
    const TOP_N = 7;
    const topKeywords = keywordEntries.slice(0, TOP_N);
    const keywordLabels = topKeywords.map(([k]) => k);
    const keywordData = topKeywords.map(([, v]) => v);
    if (ordersChart) {
      ordersChart.data.labels = keywordLabels;
      ordersChart.data.datasets[0].data = keywordData;
      ordersChart.data.datasets[0].backgroundColor = generateColors(keywordLabels.length);
      ordersChart.update();
    }
  }

  function updateAllCharts() {
    updatePieChart();
    updateBarChart();
    window.scrollTo(0, 0);
  }

  function init() {
    const ctx1 = document.getElementById('salesChart');
    const ctx2 = document.getElementById('ordersChart');
    // Fill defaults if inputs are empty
    if (!dateFromEl.value) dateFromEl.valueAsDate = new Date(sevenDaysAgo);
    if (!dateToEl.value) dateToEl.valueAsDate = new Date(today);
    if (!timeFromEl.value) timeFromEl.value = defaultTimeFrom;
    if (!timeToEl.value) timeToEl.value = defaultTimeTo;
    if (typeof Chart === 'undefined') {
      const warn = 'Chart library failed to load';
      if (ctx1) ctx1.insertAdjacentHTML('afterend', `<div style="color:#ff6b6b;font-size:12px;">${warn}</div>`);
      if (ctx2) ctx2.insertAdjacentHTML('afterend', `<div style="color:#ff6b6b;font-size:12px;">${warn}</div>`);
      return;
    }
    ensureCharts(ctx1, ctx2);
    updateAllCharts();
    window.scrollTo(0, 0);
  }

  applyBtn.addEventListener('click', updateAllCharts);
  dateFromEl.addEventListener('change', () => {});
  dateToEl.addEventListener('change', () => {});
  timeFromEl.addEventListener('change', () => {});
  timeToEl.addEventListener('change', () => {});

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

  function normalizePieDataForRendering(values) {
    const numeric = (values || []).map(v => Number(v) || 0);
    const total = numeric.reduce((a, b) => a + b, 0);
    if (total > 0) return { render: numeric, display: numeric };
    const ones = numeric.length ? numeric.map(() => 1) : [1,1,1];
    return { render: ones, display: numeric.length ? numeric : [0,0,0] };
  }


