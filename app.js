const STORAGE_KEY = "tangbanji-state-v1";
const MGDL_PER_MMOL = 18.0182;

const defaultState = {
  entries: [],
  reminders: [],
  oneShotReminders: [],
  settings: {
    patientName: "家人",
    defaultUnit: "mmol/L",
    lowThreshold: 3.9,
    premealLow: 4.4,
    premealHigh: 7.2,
    postmealHigh: 10.0,
    urgentHigh: 16.7,
    doctorPlan: ""
  }
};

let state = loadState();
let chartRange = "today";

const els = {
  heroTodayCount: document.querySelector("#hero-today-count"),
  heroNextReminder: document.querySelector("#hero-next-reminder"),
  criticalAlert: document.querySelector("#critical-alert"),
  fillNow: document.querySelector("#fill-now"),
  tabs: document.querySelectorAll("[data-tab]"),
  panels: document.querySelectorAll("[data-panel]"),
  jumpButtons: document.querySelectorAll("[data-jump]"),
  glucoseForm: document.querySelector("#glucose-form"),
  glucoseValue: document.querySelector("#glucose-value"),
  glucoseUnit: document.querySelector("#glucose-unit"),
  glucoseContext: document.querySelector("#glucose-context"),
  glucoseTime: document.querySelector("#glucose-time"),
  glucoseNote: document.querySelector("#glucose-note"),
  insulinForm: document.querySelector("#insulin-form"),
  insulinName: document.querySelector("#insulin-name"),
  insulinDose: document.querySelector("#insulin-dose"),
  insulinKind: document.querySelector("#insulin-kind"),
  insulinTime: document.querySelector("#insulin-time"),
  insulinSite: document.querySelector("#insulin-site"),
  insulinNote: document.querySelector("#insulin-note"),
  reminderForm: document.querySelector("#reminder-form"),
  reminderLabel: document.querySelector("#reminder-label"),
  reminderTime: document.querySelector("#reminder-time"),
  metricLastGlucose: document.querySelector("#metric-last-glucose"),
  metricLastStatus: document.querySelector("#metric-last-status"),
  metricInsulinToday: document.querySelector("#metric-insulin-today"),
  metricRangeRate: document.querySelector("#metric-range-rate"),
  metricFastingAverage: document.querySelector("#metric-fasting-average"),
  chartCaption: document.querySelector("#chart-caption"),
  chartRangeButtons: document.querySelectorAll("[data-chart-range]"),
  glucoseChart: document.querySelector("#glucose-chart"),
  todayList: document.querySelector("#today-list"),
  reminderList: document.querySelector("#reminder-list"),
  weeklyReport: document.querySelector("#weekly-report"),
  settingsForm: document.querySelector("#settings-form"),
  patientName: document.querySelector("#patient-name"),
  defaultUnit: document.querySelector("#default-unit"),
  lowThreshold: document.querySelector("#low-threshold"),
  premealHigh: document.querySelector("#premeal-high"),
  postmealHigh: document.querySelector("#postmeal-high"),
  urgentHigh: document.querySelector("#urgent-high"),
  doctorPlan: document.querySelector("#doctor-plan"),
  postMealReminder: document.querySelector("#post-meal-reminder"),
  enableNotifications: document.querySelector("#enable-notifications"),
  copyLastDose: document.querySelector("#copy-last-dose"),
  seedDemo: document.querySelector("#seed-demo"),
  copyReport: document.querySelector("#copy-report"),
  exportCsv: document.querySelector("#export-csv"),
  printReport: document.querySelector("#print-report"),
  clearData: document.querySelector("#clear-data")
};

initialize();

function initialize() {
  fillDateDefaults();
  hydrateSettingsForm();
  bindEvents();
  renderAll();
  setInterval(checkReminders, 30 * 1000);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      settings: { ...defaultState.settings, ...(parsed.settings || {}) },
      reminders: parsed.reminders || [],
      oneShotReminders: parsed.oneShotReminders || []
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  });

  els.chartRangeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      chartRange = button.dataset.chartRange;
      els.chartRangeButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      renderChart();
    });
  });

  els.jumpButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.jump;
      if (target === "report") {
        document.querySelector("#report").scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      activateTab(target);
      document.querySelector(".capture-card").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  els.fillNow.addEventListener("click", () => {
    fillDateDefaults();
    toast("已填入当前时间。");
  });

  els.glucoseForm.addEventListener("submit", handleGlucoseSubmit);
  els.insulinForm.addEventListener("submit", handleInsulinSubmit);
  els.reminderForm.addEventListener("submit", handleReminderSubmit);
  els.settingsForm.addEventListener("submit", handleSettingsSubmit);
  els.postMealReminder.addEventListener("click", () => createOneShotReminder("餐后2小时测血糖", 120));
  els.enableNotifications.addEventListener("click", requestNotifications);
  els.copyLastDose.addEventListener("click", copyLastInsulinDose);
  els.seedDemo.addEventListener("click", seedDemoData);
  els.copyReport.addEventListener("click", copyReport);
  els.exportCsv.addEventListener("click", exportCsv);
  els.printReport.addEventListener("click", () => window.print());
  els.clearData.addEventListener("click", clearLocalData);
}

function fillDateDefaults() {
  const now = new Date();
  const localValue = toDatetimeLocal(now);
  els.glucoseTime.value = localValue;
  els.insulinTime.value = localValue;
  els.glucoseUnit.value = state.settings.defaultUnit;
  els.glucoseContext.value = inferContext(now);
}

function hydrateSettingsForm() {
  els.patientName.value = state.settings.patientName;
  els.defaultUnit.value = state.settings.defaultUnit;
  els.lowThreshold.value = state.settings.lowThreshold;
  els.premealHigh.value = state.settings.premealHigh;
  els.postmealHigh.value = state.settings.postmealHigh;
  els.urgentHigh.value = state.settings.urgentHigh;
  els.doctorPlan.value = state.settings.doctorPlan;
}

function activateTab(name) {
  els.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === name));
  els.panels.forEach((panel) => panel.classList.toggle("hidden", panel.dataset.panel !== name));
}

function handleGlucoseSubmit(event) {
  event.preventDefault();
  const value = Number(els.glucoseValue.value);
  if (!Number.isFinite(value) || value <= 0) {
    toast("请填写有效的血糖值。");
    return;
  }

  const entry = {
    id: createId(),
    type: "glucose",
    value,
    unit: els.glucoseUnit.value,
    context: els.glucoseContext.value,
    timestamp: new Date(els.glucoseTime.value).toISOString(),
    tags: [...document.querySelectorAll('input[name="glucose-tag"]:checked')].map((input) => input.value),
    note: els.glucoseNote.value.trim()
  };

  state.entries.push(entry);
  saveState();
  els.glucoseForm.reset();
  fillDateDefaults();
  renderAll();

  const status = classifyGlucose(toMmol(entry.value, entry.unit), entry.context);
  toast(status.toast || "血糖记录已保存。");
}

function handleInsulinSubmit(event) {
  event.preventDefault();
  const dose = Number(els.insulinDose.value);
  if (!Number.isFinite(dose) || dose < 0) {
    toast("请填写有效的胰岛素剂量。");
    return;
  }

  state.entries.push({
    id: createId(),
    type: "insulin",
    name: els.insulinName.value.trim(),
    dose,
    kind: els.insulinKind.value,
    site: els.insulinSite.value,
    timestamp: new Date(els.insulinTime.value).toISOString(),
    note: els.insulinNote.value.trim()
  });

  saveState();
  els.insulinForm.reset();
  fillDateDefaults();
  renderAll();
  toast("胰岛素记录已保存。");
}

function handleReminderSubmit(event) {
  event.preventDefault();
  state.reminders.push({
    id: createId(),
    label: els.reminderLabel.value.trim(),
    time: els.reminderTime.value,
    enabled: true,
    lastNotified: ""
  });
  saveState();
  els.reminderForm.reset();
  renderAll();
  toast("提醒已添加。");
}

function handleSettingsSubmit(event) {
  event.preventDefault();
  state.settings = {
    ...state.settings,
    patientName: els.patientName.value.trim() || "家人",
    defaultUnit: els.defaultUnit.value,
    lowThreshold: Number(els.lowThreshold.value) || defaultState.settings.lowThreshold,
    premealHigh: Number(els.premealHigh.value) || defaultState.settings.premealHigh,
    postmealHigh: Number(els.postmealHigh.value) || defaultState.settings.postmealHigh,
    urgentHigh: Number(els.urgentHigh.value) || defaultState.settings.urgentHigh,
    doctorPlan: els.doctorPlan.value.trim()
  };
  saveState();
  renderAll();
  toast("医生目标与备注已保存。");
}

function renderAll() {
  sortEntries();
  renderHero();
  renderMetrics();
  renderChart();
  renderTodayList();
  renderReminderList();
  renderReport();
  renderCriticalAlert();
}

function sortEntries() {
  state.entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function renderHero() {
  const todayEntries = state.entries.filter((entry) => isToday(entry.timestamp));
  els.heroTodayCount.textContent = `${todayEntries.length} 条`;

  const nextReminder = getNextReminder();
  els.heroNextReminder.textContent = nextReminder
    ? `下一个提醒 ${nextReminder.timeText} ${nextReminder.label}`
    : "暂无提醒";
}

function renderMetrics() {
  const glucoseEntries = getGlucoseEntries();
  const last = glucoseEntries[0];

  if (last) {
    const mmol = toMmol(last.value, last.unit);
    const status = classifyGlucose(mmol, last.context);
    els.metricLastGlucose.textContent = formatGlucose(last.value, last.unit);
    els.metricLastStatus.textContent = `${last.context} · ${status.label}`;
    els.metricLastStatus.className = status.className;
  } else {
    els.metricLastGlucose.textContent = "暂无";
    els.metricLastStatus.textContent = "先记录一次";
    els.metricLastStatus.className = "";
  }

  const todayInsulin = state.entries
    .filter((entry) => entry.type === "insulin" && isToday(entry.timestamp))
    .reduce((sum, entry) => sum + Number(entry.dose || 0), 0);
  els.metricInsulinToday.textContent = `${trimNumber(todayInsulin)} U`;

  const recentGlucose = glucoseEntries.filter((entry) => withinDays(entry.timestamp, 7));
  const inRange = recentGlucose.filter((entry) => classifyGlucose(toMmol(entry.value, entry.unit), entry.context).level === "ok");
  els.metricRangeRate.textContent = recentGlucose.length
    ? `${Math.round((inRange.length / recentGlucose.length) * 100)}%`
    : "--";

  const fasting = recentGlucose.filter((entry) => isFastingContext(entry.context));
  const fastingAverage = average(fasting.map((entry) => toMmol(entry.value, entry.unit)));
  els.metricFastingAverage.textContent = fastingAverage ? `${trimNumber(fastingAverage)} mmol/L` : "--";
}

function renderChart() {
  const windowRange = getChartWindow(chartRange);
  const entries = getGlucoseEntries()
    .filter((entry) => {
      const time = new Date(entry.timestamp);
      return time >= windowRange.start && time <= windowRange.end;
    })
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  els.chartCaption.textContent = `${windowRange.label} · 纵坐标 1 mmol/L 刻度 · 横坐标显示${windowRange.axisHint}`;

  if (!entries.length) {
    els.glucoseChart.className = "chart-empty";
    els.glucoseChart.textContent = `${windowRange.label}暂无血糖记录。`;
    return;
  }

  const values = entries.map((entry) => toMmol(entry.value, entry.unit));
  const minValue = Math.max(0, Math.floor(Math.min(...values, state.settings.lowThreshold) - 1));
  const maxValue = Math.ceil(Math.max(...values, state.settings.urgentHigh, state.settings.postmealHigh) + 1);
  const width = 860;
  const height = 330;
  const pad = { top: 26, right: 26, bottom: 66, left: 58 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const timeMin = windowRange.start.getTime();
  const timeMax = windowRange.end.getTime();
  const span = Math.max(1, timeMax - timeMin);

  const x = (date) => pad.left + ((new Date(date).getTime() - timeMin) / span) * plotWidth;
  const y = (value) => pad.top + (1 - ((value - minValue) / (maxValue - minValue))) * plotHeight;
  const points = entries.map((entry) => `${x(entry.timestamp)},${y(toMmol(entry.value, entry.unit))}`).join(" ");
  const lowY = y(state.settings.lowThreshold);
  const premealHighY = y(state.settings.premealHigh);
  const postmealHighY = y(state.settings.postmealHigh);
  const urgentY = y(state.settings.urgentHigh);
  const yTicks = createYAxisTicks(minValue, maxValue, y, pad, width);
  const xTicks = createXAxisTicks(chartRange, windowRange.start, windowRange.end, x, height, pad);
  const pointLabels = entries.length <= 18 ? entries.map((entry, index) => {
    const mmol = toMmol(entry.value, entry.unit);
    const labelY = y(mmol) - (index % 2 === 0 ? 12 : 22);
    return `<text x="${x(entry.timestamp)}" y="${Math.max(14, labelY)}" text-anchor="middle" class="point-label">${escapeHtml(abbreviateContext(entry.context))}</text>`;
  }).join("") : "";
  const circles = entries.map((entry) => {
    const mmol = toMmol(entry.value, entry.unit);
    const status = classifyGlucose(mmol, entry.context);
    return `<circle cx="${x(entry.timestamp)}" cy="${y(mmol)}" r="5" class="point ${status.level}">
      <title>${formatDateTime(entry.timestamp)} ${entry.context}: ${trimNumber(mmol)} mmol/L</title>
    </circle>`;
  }).join("");

  els.glucoseChart.className = "";
  els.glucoseChart.innerHTML = `
    <svg class="glucose-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="最近14天血糖趋势">
      <defs>
        <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#1f6f68" />
          <stop offset="100%" stop-color="#d77b37" />
        </linearGradient>
      </defs>
      <rect x="${pad.left}" y="${postmealHighY}" width="${plotWidth}" height="${Math.max(2, lowY - postmealHighY)}" rx="10" fill="rgba(61, 128, 82, 0.12)" />
      ${yTicks}
      ${xTicks}
      <line x1="${pad.left}" y1="${lowY}" x2="${width - pad.right}" y2="${lowY}" stroke="#b84638" class="target-line" />
      <line x1="${pad.left}" y1="${premealHighY}" x2="${width - pad.right}" y2="${premealHighY}" stroke="#3d8052" class="target-line" />
      <line x1="${pad.left}" y1="${postmealHighY}" x2="${width - pad.right}" y2="${postmealHighY}" stroke="#1f6f68" class="target-line" />
      <line x1="${pad.left}" y1="${urgentY}" x2="${width - pad.right}" y2="${urgentY}" stroke="#b84638" class="urgent-line" />
      <line x1="${pad.left}" y1="${pad.top + plotHeight}" x2="${width - pad.right}" y2="${pad.top + plotHeight}" class="axis-line" />
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + plotHeight}" class="axis-line" />
      ${entries.length > 1 ? `<polyline points="${points}" fill="none" stroke="url(#lineGradient)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />` : ""}
      ${circles}
      ${pointLabels}
      <text x="${pad.left}" y="${Math.max(14, lowY - 7)}" fill="#b84638" font-size="12">低血糖 ${state.settings.lowThreshold}</text>
      <text x="${pad.left}" y="${Math.max(14, premealHighY - 7)}" fill="#3d8052" font-size="12">餐前上限 ${state.settings.premealHigh}</text>
      <text x="${pad.left + 132}" y="${Math.max(14, postmealHighY - 7)}" fill="#1f6f68" font-size="12">餐后上限 ${state.settings.postmealHigh}</text>
      <text x="${width - pad.right - 116}" y="${Math.max(14, urgentY - 7)}" fill="#b84638" font-size="12">明显高 ${state.settings.urgentHigh}</text>
      <text x="${pad.left - 44}" y="${pad.top - 8}" class="axis-label">mmol/L</text>
    </svg>
    <div class="chart-points" aria-label="图中数据点明细">
      ${entries.map((entry) => {
        const mmol = toMmol(entry.value, entry.unit);
        return `<span class="chart-point-pill">${escapeHtml(formatChartPointLabel(entry))} · ${trimNumber(mmol)}</span>`;
      }).join("")}
    </div>
  `;
}

function getChartWindow(range) {
  const now = new Date();
  if (range === "week") {
    return {
      start: startOfWeek(now),
      end: endOfWeek(now),
      label: "本周血糖趋势",
      axisHint: "日期"
    };
  }

  if (range === "month") {
    return {
      start: startOfMonth(now),
      end: endOfMonth(now),
      label: "本月血糖趋势",
      axisHint: "日期"
    };
  }

  return {
    start: startOfDay(now),
    end: endOfDay(now),
    label: "今日血糖趋势",
    axisHint: "具体时间"
  };
}

function createYAxisTicks(minValue, maxValue, y, pad, width) {
  const ticks = [];
  for (let value = minValue; value <= maxValue; value += 1) {
    const tickY = y(value);
    ticks.push(`
      <line x1="${pad.left}" y1="${tickY}" x2="${width - pad.right}" y2="${tickY}" class="grid-line" />
      <text x="${pad.left - 10}" y="${tickY + 4}" text-anchor="end" class="tick-label">${value}</text>
    `);
  }
  return ticks.join("");
}

function createXAxisTicks(range, start, end, x, height, pad) {
  let ticks = [];

  if (range === "today") {
    ticks = [0, 6, 12, 18, 24].map((hour) => {
      const date = new Date(start);
      date.setHours(Math.min(hour, 23), hour === 24 ? 59 : 0, 0, 0);
      return {
        date,
        label: hour === 24 ? "24:00" : `${String(hour).padStart(2, "0")}:00`
      };
    });
  } else if (range === "week") {
    for (let date = new Date(start); date <= end; date = addDays(date, 1)) {
      ticks.push({ date: new Date(date), label: `${formatMonthDay(date)} ${formatWeekday(date)}` });
    }
  } else {
    const days = new Set([1, 8, 15, 22, end.getDate()]);
    ticks = [...days]
      .sort((a, b) => a - b)
      .map((day) => {
        const date = new Date(start.getFullYear(), start.getMonth(), day);
        return { date, label: formatMonthDay(date) };
      });
  }

  return ticks.map((tick) => {
    const tickX = x(tick.date);
    return `
      <line x1="${tickX}" y1="${pad.top}" x2="${tickX}" y2="${height - pad.bottom}" class="grid-line" />
      <text x="${tickX}" y="${height - pad.bottom + 23}" text-anchor="middle" class="tick-label">${tick.label}</text>
    `;
  }).join("");
}

function abbreviateContext(context = "") {
  const map = {
    "空腹": "空腹",
    "早餐前": "早前",
    "早餐后2小时": "早后2h",
    "午餐前": "午前",
    "午餐后2小时": "午后2h",
    "晚餐前": "晚前",
    "晚餐后2小时": "晚后2h",
    "睡前": "睡前",
    "夜间": "夜间",
    "运动前": "动前",
    "运动后": "动后"
  };
  return map[context] || context || "未标记";
}

function formatChartPointLabel(entry) {
  const context = abbreviateContext(entry.context);
  if (chartRange === "today") return `${formatTime(entry.timestamp)} ${context}`;
  return `${formatMonthDay(entry.timestamp)} ${formatTime(entry.timestamp)} ${context}`;
}

function renderTodayList() {
  const todayEntries = state.entries.filter((entry) => isToday(entry.timestamp));
  if (!todayEntries.length) {
    els.todayList.className = "timeline empty-state";
    els.todayList.textContent = "今天还没有记录。";
    return;
  }

  els.todayList.className = "timeline";
  els.todayList.innerHTML = "";
  todayEntries.forEach((entry) => {
    const item = document.querySelector("#timeline-item-template").content.firstElementChild.cloneNode(true);
    const dot = item.querySelector(".timeline-dot");
    const title = item.querySelector("strong");
    const desc = item.querySelector("p");
    const meta = item.querySelector("small");
    const button = item.querySelector("button");

    if (entry.type === "glucose") {
      const mmol = toMmol(entry.value, entry.unit);
      const status = classifyGlucose(mmol, entry.context);
      dot.classList.add(status.level);
      title.textContent = `血糖 ${formatGlucose(entry.value, entry.unit)} · ${status.label}`;
      desc.textContent = `${entry.context}${entry.tags.length ? " · " + entry.tags.join("、") : ""}`;
      meta.textContent = `${formatTime(entry.timestamp)}${entry.note ? " · " + entry.note : ""}`;
    } else {
      dot.classList.add("insulin");
      title.textContent = `${entry.name} ${trimNumber(entry.dose)} U`;
      desc.textContent = `${entry.kind} · ${entry.site}`;
      meta.textContent = `${formatTime(entry.timestamp)}${entry.note ? " · " + entry.note : ""}`;
    }

    button.addEventListener("click", () => deleteEntry(entry.id));
    els.todayList.appendChild(item);
  });
}

function renderReminderList() {
  const reminders = [...state.reminders, ...state.oneShotReminders.filter((item) => !item.done)]
    .sort((a, b) => getReminderSortValue(a) - getReminderSortValue(b));

  if (!reminders.length) {
    els.reminderList.className = "reminder-list empty-state";
    els.reminderList.textContent = "暂无提醒。";
    return;
  }

  els.reminderList.className = "reminder-list";
  els.reminderList.innerHTML = "";
  reminders.forEach((reminder) => {
    const item = document.createElement("article");
    item.className = "reminder-item";
    item.innerHTML = `
      <div class="timeline-dot ${reminder.at ? "high" : "ok"}"></div>
      <div>
        <strong>${escapeHtml(reminder.label)}</strong>
        <p>${reminder.at ? formatDateTime(reminder.at) : "每天 " + reminder.time}</p>
        <small>${reminder.at ? "一次性提醒" : "每日提醒"}</small>
      </div>
      <button type="button">删除</button>
    `;
    item.querySelector("button").addEventListener("click", () => deleteReminder(reminder.id));
    els.reminderList.appendChild(item);
  });
}

function renderReport() {
  const report = buildWeeklyReport();
  els.weeklyReport.innerHTML = `
    <div class="report-summary">
      <article><span>血糖记录</span><strong>${report.glucoseCount} 次</strong></article>
      <article><span>低血糖</span><strong>${report.lowCount} 次</strong></article>
      <article><span>偏高/明显高</span><strong>${report.highCount} 次</strong></article>
      <article><span>胰岛素总量</span><strong>${trimNumber(report.insulinTotal)} U</strong></article>
    </div>
    <div class="report-text">${escapeHtml(report.text)}</div>
  `;
}

function renderCriticalAlert() {
  const latestRisk = getGlucoseEntries()
    .slice(0, 5)
    .map((entry) => ({ entry, status: classifyGlucose(toMmol(entry.value, entry.unit), entry.context) }))
    .find((item) => item.status.level === "low" || item.status.level === "urgent");

  if (!latestRisk || !isToday(latestRisk.entry.timestamp)) {
    els.criticalAlert.classList.add("hidden");
    els.criticalAlert.textContent = "";
    return;
  }

  els.criticalAlert.classList.remove("hidden");
  els.criticalAlert.innerHTML = `
    <strong>${latestRisk.status.label}提醒：</strong>
    ${latestRisk.status.message}
  `;
}

function buildWeeklyReport() {
  const since = startOfDay(addDays(new Date(), -6));
  const entries = state.entries.filter((entry) => new Date(entry.timestamp) >= since);
  const glucose = entries.filter((entry) => entry.type === "glucose");
  const insulin = entries.filter((entry) => entry.type === "insulin");
  const statuses = glucose.map((entry) => classifyGlucose(toMmol(entry.value, entry.unit), entry.context));
  const lowCount = statuses.filter((status) => status.level === "low").length;
  const highCount = statuses.filter((status) => status.level === "high" || status.level === "urgent").length;
  const insulinTotal = insulin.reduce((sum, entry) => sum + Number(entry.dose || 0), 0);
  const fastingAverage = average(glucose.filter((entry) => isFastingContext(entry.context)).map((entry) => toMmol(entry.value, entry.unit)));
  const postMealAverage = average(glucose.filter((entry) => isPostMealContext(entry.context)).map((entry) => toMmol(entry.value, entry.unit)));
  const dailyLines = summarizeDaily(entries);
  const abnormalLines = glucose
    .filter((entry) => classifyGlucose(toMmol(entry.value, entry.unit), entry.context).level !== "ok")
    .slice(0, 8)
    .map((entry) => {
      const status = classifyGlucose(toMmol(entry.value, entry.unit), entry.context);
      return `- ${formatDateTime(entry.timestamp)} ${entry.context} ${formatGlucose(entry.value, entry.unit)}：${status.label}`;
    });

  const text = [
    `${state.settings.patientName}的近7天糖尿病记录摘要`,
    `时间范围：${formatDate(since)} 至 ${formatDate(new Date())}`,
    "",
    `血糖记录：${glucose.length} 次；胰岛素记录：${insulin.length} 次；胰岛素总量：${trimNumber(insulinTotal)} U。`,
    `低血糖次数：${lowCount} 次；偏高/明显高血糖次数：${highCount} 次。`,
    `空腹血糖均值：${fastingAverage ? trimNumber(fastingAverage) + " mmol/L" : "暂无足够记录"}。`,
    `餐后2小时血糖均值：${postMealAverage ? trimNumber(postMealAverage) + " mmol/L" : "暂无足够记录"}。`,
    "",
    "每日概览：",
    dailyLines.length ? dailyLines.join("\n") : "- 暂无记录",
    "",
    "异常记录：",
    abnormalLines.length ? abnormalLines.join("\n") : "- 本周未记录到低血糖或明显偏高。",
    "",
    "医生规则/复诊备注：",
    state.settings.doctorPlan || "尚未录入。建议把医生给出的个体化目标和调药规则写在这里。"
  ].join("\n");

  return {
    glucoseCount: glucose.length,
    lowCount,
    highCount,
    insulinTotal,
    text
  };
}

function summarizeDaily(entries) {
  const map = new Map();
  entries.forEach((entry) => {
    const day = formatDate(entry.timestamp);
    if (!map.has(day)) map.set(day, { glucose: 0, insulin: 0, insulinDose: 0, low: 0, high: 0 });
    const item = map.get(day);
    if (entry.type === "glucose") {
      item.glucose += 1;
      const level = classifyGlucose(toMmol(entry.value, entry.unit), entry.context).level;
      if (level === "low") item.low += 1;
      if (level === "high" || level === "urgent") item.high += 1;
    } else {
      item.insulin += 1;
      item.insulinDose += Number(entry.dose || 0);
    }
  });

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, item]) => `- ${day}：血糖 ${item.glucose} 次，胰岛素 ${item.insulin} 次/${trimNumber(item.insulinDose)} U，低血糖 ${item.low} 次，偏高 ${item.high} 次`);
}

function classifyGlucose(mmol, context) {
  const settings = state.settings;
  if (mmol < settings.lowThreshold) {
    return {
      level: "low",
      label: "低血糖",
      className: "status-low",
      toast: "血糖低于阈值，请按医生低血糖处理方案处理。",
      message: "血糖低于低血糖阈值。请按医生预案处理；若意识不清、无法进食或反复不缓解，请立即就医。"
    };
  }

  if (mmol >= settings.urgentHigh) {
    return {
      level: "urgent",
      label: "明显高血糖",
      className: "status-urgent",
      toast: "血糖明显偏高，请复测并按医生方案处理。",
      message: "血糖达到明显高血糖提醒线。建议复测、检查漏打/感染/饮食因素，并按医生方案联系医生。"
    };
  }

  const highLimit = isPostMealContext(context) ? settings.postmealHigh : settings.premealHigh;
  if (mmol > highLimit) {
    return {
      level: "high",
      label: "偏高",
      className: "status-high",
      toast: "血糖记录已保存，本次高于当前目标。",
      message: "本次血糖高于当前目标范围。"
    };
  }

  return {
    level: "ok",
    label: "目标内",
    className: "status-ok",
    toast: "血糖记录已保存，当前在目标范围内。",
    message: "本次血糖在当前目标范围内。"
  };
}

function requestNotifications() {
  if (!("Notification" in window)) {
    toast("当前浏览器不支持通知。");
    return;
  }

  Notification.requestPermission().then((permission) => {
    toast(permission === "granted" ? "通知已开启。页面打开时会弹出提醒。" : "未开启通知，仍会在页面内提醒。");
  });
}

function createOneShotReminder(label, minutesFromNow) {
  const at = addMinutes(new Date(), minutesFromNow);
  state.oneShotReminders.push({
    id: createId(),
    label,
    at: at.toISOString(),
    done: false
  });
  saveState();
  renderAll();
  toast(`${label}已设置：${formatTime(at)}。`);
}

function checkReminders() {
  const now = new Date();
  const todayStamp = formatDate(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let changed = false;

  state.reminders.forEach((reminder) => {
    if (!reminder.enabled || !reminder.time) return;
    const [hours, minutes] = reminder.time.split(":").map(Number);
    const reminderMinutes = hours * 60 + minutes;
    const stamp = `${todayStamp}-${reminder.time}`;
    if (currentMinutes >= reminderMinutes && currentMinutes - reminderMinutes <= 5 && reminder.lastNotified !== stamp) {
      notify(reminder.label);
      reminder.lastNotified = stamp;
      changed = true;
    }
  });

  state.oneShotReminders.forEach((reminder) => {
    if (reminder.done) return;
    const diffMs = now.getTime() - new Date(reminder.at).getTime();
    if (diffMs >= 0 && diffMs <= 5 * 60 * 1000) {
      notify(reminder.label);
      reminder.done = true;
      changed = true;
    }
  });

  if (changed) {
    saveState();
    renderAll();
  }
}

function notify(label) {
  toast(`提醒：${label}`);
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("糖伴记提醒", { body: label });
  }
}

function copyLastInsulinDose() {
  const last = state.entries.find((entry) => entry.type === "insulin");
  if (!last) {
    toast("还没有胰岛素记录可复制。");
    return;
  }
  els.insulinName.value = last.name;
  els.insulinDose.value = last.dose;
  els.insulinKind.value = last.kind;
  els.insulinSite.value = rotateSite(last.site);
  toast("已复制上次剂量，并建议轮换注射部位。");
}

function seedDemoData() {
  if (state.entries.length && !confirm("当前已有记录。是否追加一组示例数据？")) return;

  const contexts = ["空腹", "早餐后2小时", "晚餐前", "睡前"];
  const insulinNames = ["门冬胰岛素", "甘精胰岛素"];
  const now = new Date();
  for (let dayOffset = 6; dayOffset >= 0; dayOffset -= 1) {
    contexts.forEach((context, index) => {
      const date = startOfDay(addDays(now, -dayOffset));
      date.setHours([7, 10, 17, 22][index], [15, 30, 50, 10][index]);
      const base = context.includes("后") ? 8.6 : context === "空腹" ? 6.7 : 7.2;
      const wobble = Math.sin(dayOffset + index) * 1.2 + (dayOffset === 2 && index === 1 ? 3.2 : 0);
      state.entries.push({
        id: createId(),
        type: "glucose",
        value: Number((base + wobble).toFixed(1)),
        unit: "mmol/L",
        context,
        timestamp: date.toISOString(),
        tags: dayOffset === 2 && index === 1 ? ["吃多了"] : [],
        note: ""
      });
    });

    const mealInsulinTime = startOfDay(addDays(now, -dayOffset));
    mealInsulinTime.setHours(7, 0);
    state.entries.push({
      id: createId(),
      type: "insulin",
      name: insulinNames[0],
      dose: dayOffset === 2 ? 10 : 8,
      kind: "餐时/速效",
      site: dayOffset % 2 ? "腹部左侧" : "腹部右侧",
      timestamp: mealInsulinTime.toISOString(),
      note: ""
    });

    const basalTime = startOfDay(addDays(now, -dayOffset));
    basalTime.setHours(21, 30);
    state.entries.push({
      id: createId(),
      type: "insulin",
      name: insulinNames[1],
      dose: 12,
      kind: "基础/长效",
      site: dayOffset % 2 ? "左大腿" : "右大腿",
      timestamp: basalTime.toISOString(),
      note: ""
    });
  }

  saveState();
  renderAll();
  toast("示例数据已载入，可以直接查看趋势和周报。");
}

function copyReport() {
  const report = buildWeeklyReport().text;
  if (!navigator.clipboard) {
    toast("当前环境不支持剪贴板，请使用打印/PDF。");
    return;
  }
  navigator.clipboard.writeText(report)
    .then(() => toast("周报摘要已复制。"))
    .catch(() => toast("复制失败，请使用打印/PDF。"));
}

function exportCsv() {
  const header = ["类型", "时间", "血糖值", "单位", "时间点", "胰岛素名称", "剂量U", "胰岛素类型", "部位", "标签", "备注"];
  const rows = state.entries
    .slice()
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map((entry) => [
      entry.type === "glucose" ? "血糖" : "胰岛素",
      formatDateTime(entry.timestamp),
      entry.type === "glucose" ? entry.value : "",
      entry.type === "glucose" ? entry.unit : "",
      entry.context || "",
      entry.name || "",
      entry.dose || "",
      entry.kind || "",
      entry.site || "",
      (entry.tags || []).join("、"),
      entry.note || ""
    ]);

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `糖伴记记录-${formatDate(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function clearLocalData() {
  if (!confirm("确认清空所有本地记录、提醒和设置？此操作无法恢复。")) return;
  state = structuredClone(defaultState);
  saveState();
  hydrateSettingsForm();
  fillDateDefaults();
  renderAll();
  toast("本地数据已清空。");
}

function deleteEntry(id) {
  state.entries = state.entries.filter((entry) => entry.id !== id);
  saveState();
  renderAll();
  toast("记录已删除。");
}

function deleteReminder(id) {
  state.reminders = state.reminders.filter((reminder) => reminder.id !== id);
  state.oneShotReminders = state.oneShotReminders.filter((reminder) => reminder.id !== id);
  saveState();
  renderAll();
  toast("提醒已删除。");
}

function getGlucoseEntries() {
  return state.entries.filter((entry) => entry.type === "glucose");
}

function getNextReminder() {
  const now = new Date();
  const todayMinutes = now.getHours() * 60 + now.getMinutes();
  const daily = state.reminders
    .filter((reminder) => reminder.enabled)
    .map((reminder) => {
      const [hours, minutes] = reminder.time.split(":").map(Number);
      const reminderMinutes = hours * 60 + minutes;
      return {
        label: reminder.label,
        timeText: reminder.time,
        sort: reminderMinutes >= todayMinutes ? reminderMinutes : reminderMinutes + 24 * 60
      };
    });

  const oneShot = state.oneShotReminders
    .filter((reminder) => !reminder.done && new Date(reminder.at) > now)
    .map((reminder) => ({
      label: reminder.label,
      timeText: formatTime(reminder.at),
      sort: Math.floor((new Date(reminder.at) - now) / 60000)
    }));

  return [...daily, ...oneShot].sort((a, b) => a.sort - b.sort)[0];
}

function getReminderSortValue(reminder) {
  if (reminder.at) return new Date(reminder.at).getTime();
  const [hours, minutes] = reminder.time.split(":").map(Number);
  return hours * 60 + minutes;
}

function toMmol(value, unit) {
  return unit === "mg/dL" ? value / MGDL_PER_MMOL : value;
}

function fromMmol(value, unit) {
  return unit === "mg/dL" ? value * MGDL_PER_MMOL : value;
}

function formatGlucose(value, unit) {
  return `${trimNumber(value)} ${unit}`;
}

function trimNumber(value) {
  return Number(value).toFixed(1).replace(/\.0$/, "");
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function isToday(dateLike) {
  return formatDate(dateLike) === formatDate(new Date());
}

function withinDays(dateLike, days) {
  const diff = new Date() - new Date(dateLike);
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function startOfDay(dateLike) {
  const date = new Date(dateLike);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(dateLike) {
  const date = new Date(dateLike);
  date.setHours(23, 59, 59, 999);
  return date;
}

function startOfWeek(dateLike) {
  const date = startOfDay(dateLike);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return date;
}

function endOfWeek(dateLike) {
  return endOfDay(addDays(startOfWeek(dateLike), 6));
}

function startOfMonth(dateLike) {
  const date = new Date(dateLike);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(dateLike) {
  const date = new Date(dateLike);
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function addDays(dateLike, days) {
  const date = new Date(dateLike);
  date.setDate(date.getDate() + days);
  return date;
}

function addMinutes(dateLike, minutes) {
  const date = new Date(dateLike);
  date.setMinutes(date.getMinutes() + minutes);
  return date;
}

function toDatetimeLocal(dateLike) {
  const date = new Date(dateLike);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function formatDate(dateLike) {
  const date = new Date(dateLike);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthDay(dateLike) {
  const date = new Date(dateLike);
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function formatWeekday(dateLike) {
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date(dateLike).getDay()];
}

function formatTime(dateLike) {
  const date = new Date(dateLike);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDateTime(dateLike) {
  return `${formatDate(dateLike)} ${formatTime(dateLike)}`;
}

function inferContext(dateLike) {
  const hour = new Date(dateLike).getHours();
  if (hour >= 5 && hour < 8) return "空腹";
  if (hour >= 8 && hour < 10) return "早餐前";
  if (hour >= 10 && hour < 12) return "早餐后2小时";
  if (hour >= 12 && hour < 14) return "午餐前";
  if (hour >= 14 && hour < 17) return "午餐后2小时";
  if (hour >= 17 && hour < 20) return "晚餐前";
  if (hour >= 20 && hour < 22) return "晚餐后2小时";
  if (hour >= 22 || hour < 2) return "睡前";
  return "夜间";
}

function isPostMealContext(context = "") {
  return context.includes("后");
}

function isFastingContext(context = "") {
  return context.includes("空腹") || context.includes("早餐前");
}

function rotateSite(site) {
  const sites = ["腹部左侧", "腹部右侧", "左上臂", "右上臂", "左大腿", "右大腿", "臀部"];
  const index = sites.indexOf(site);
  if (index === -1) return "腹部左侧";
  return sites[(index + 1) % sites.length];
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toast(message) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 3200);
}
