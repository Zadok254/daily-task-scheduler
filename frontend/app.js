// ── DTS Frontend App ──────────────────────────────────────────────────────────
'use strict';

const API = 'http://localhost:3000/api';

// ── State ─────────────────────────────────────────────────────────────────────
let schedule       = [];          // array of task objects from server
let tickInterval   = null;        // main 1-second ticker
let alarmTimers    = [];          // setTimeout handles for alarms
let warnTimers     = [];          // setTimeout handles for 1-min warnings
let dayEnded       = false;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $inputPanel    = document.getElementById('input-panel');
const $dashboard     = document.getElementById('dashboard');
const $taskInput     = document.getElementById('task-input');
const $btnGenerate   = document.getElementById('btn-generate');
const $btnReset      = document.getElementById('btn-reset');
const $btnNewDay     = document.getElementById('btn-new-day');
const $clock         = document.getElementById('clock');
const $dateDisplay   = document.getElementById('date-display');
const $timetable     = document.getElementById('timetable');
const $activeTask    = document.getElementById('active-task-name');
const $countdown     = document.getElementById('countdown');
const $nextTask      = document.getElementById('next-task-name');
const $nextTime      = document.getElementById('next-task-time');
const $summaryCard   = document.getElementById('summary-card');
const $summaryContent= document.getElementById('summary-content');
const $toast         = document.getElementById('toast');

// ── Clock ─────────────────────────────────────────────────────────────────────
function startClock() {
  const tick = () => {
    const now = new Date();
    $clock.textContent = now.toTimeString().slice(0, 8);
    $dateDisplay.textContent = now.toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  };
  tick();
  setInterval(tick, 1000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function nowMinutes() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

function msUntilTime(timeStr) {
  const now = new Date();
  const [h, m] = timeStr.split(':').map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  return target - now;
}

function pad(n) { return String(n).padStart(2, '0'); }

function formatCountdown(secs) {
  if (secs <= 0) return '00:00';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${pad(m)}:${pad(s)}`;
}

// ── Audio alarm (Web Audio API — no file needed) ───────────────────────────────
function playAlarm(type = 'start') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const tones = type === 'warn'
      ? [{ f: 660, t: 0, d: 0.25 }, { f: 660, t: 0.3, d: 0.25 }]
      : [{ f: 880, t: 0, d: 0.3  }, { f: 1100, t: 0.35, d: 0.3 }, { f: 880, t: 0.7, d: 0.3 }];

    tones.forEach(({ f, t, d }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = f;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.4, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + d);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + d + 0.05);
    });
  } catch (e) {
    // AudioContext blocked until user interaction — silently skip
  }
}

// ── Toast notification ────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, duration = 5000) {
  $toast.textContent = msg;
  $toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.add('hidden'), duration);
}

// ── Render timetable ──────────────────────────────────────────────────────────
function renderTimetable() {
  $timetable.innerHTML = '';

  schedule.forEach((task, i) => {
    const row = document.createElement('div');
    row.className = `task-row ${task.status}`;
    row.id = `task-row-${task.id}`;

    const badgeClass = task.status;

    const badgeLabel = {
      active:    'in progress',
      pending:   '',
      completed: 'done ✓',
      missed:    'missed'
    }[task.status] || '';

    row.innerHTML = `
      <div class="task-dot"></div>
      <div class="task-time">${task.start} – ${task.end}</div>
      <div class="task-name">${task.name}</div>
      <span class="task-status-text">${badgeLabel}</span>
    `;
    $timetable.appendChild(row);

    // Break indicator (except after last task)
    if (i < schedule.length - 1) {
      const brk = document.createElement('div');
      brk.className = 'break-row';
      brk.innerHTML = '<span class="break-label">10 min break</span>';
      $timetable.appendChild(brk);
    }
  });
}

// ── Update active/next status cards ──────────────────────────────────────────
function updateStatusCards() {
  const now = nowMinutes();
  const active = schedule.find(t => t.startMinutes <= now && now < t.endMinutes);
  const next   = schedule.find(t => t.startMinutes > now && t.status !== 'completed');

  if (active) {
    $activeTask.textContent = active.name;
    const secsLeft = (active.endMinutes * 60) - (new Date().getHours() * 3600 + new Date().getMinutes() * 60 + new Date().getSeconds());
    $countdown.textContent  = formatCountdown(Math.max(0, secsLeft));
  } else {
    $activeTask.textContent = 'No active task';
    $countdown.textContent  = '--:--';
  }

  if (next) {
    $nextTask.textContent = next.name;
    $nextTime.textContent = `Starts at ${next.start}`;
  } else {
    $nextTask.textContent = 'None';
    $nextTime.textContent = '';
  }
}

// ── Sync task statuses from server time ───────────────────────────────────────
async function syncStatuses() {
  const now = nowMinutes();
  let changed = false;

  for (const task of schedule) {
    let newStatus = task.status;

    if (now >= task.startMinutes && now < task.endMinutes) {
      newStatus = 'active';
    } else if (now >= task.endMinutes && task.status !== 'completed') {
      newStatus = 'missed';
    }

    if (newStatus !== task.status) {
      task.status = newStatus;
      changed = true;
      await fetch(`${API}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      }).catch(() => {});
    }
  }

  if (changed) renderTimetable();
}

// ── Main ticker (runs every second) ──────────────────────────────────────────
function startTicker() {
  clearInterval(tickInterval);
  tickInterval = setInterval(async () => {
    await syncStatuses();
    updateStatusCards();
    checkEndOfDay();
  }, 1000);
}

// ── Schedule alarms ───────────────────────────────────────────────────────────
function clearTimers() {
  [...alarmTimers, ...warnTimers].forEach(clearTimeout);
  alarmTimers = [];
  warnTimers  = [];
}

function scheduleAlarms() {
  clearTimers();

  schedule.forEach(task => {
    const msStart = msUntilTime(task.start);
    const msWarn  = msStart - 60_000; // 1 min before

    if (msWarn > 0) {
      warnTimers.push(setTimeout(() => {
        showToast(`⏰ "${task.name}" starts in 1 minute!`, 8000);
        playAlarm('warn');
      }, msWarn));
    }

    if (msStart > 0) {
      alarmTimers.push(setTimeout(() => {
        showToast(`🚀 Time to start: "${task.name}"`, 8000);
        playAlarm('start');
      }, msStart));
    }
  });
}

// ── End of day ────────────────────────────────────────────────────────────────
function checkEndOfDay() {
  if (dayEnded || schedule.length === 0) return;
  const lastTask = schedule[schedule.length - 1];
  if (nowMinutes() >= lastTask.endMinutes) {
    dayEnded = true;
    clearInterval(tickInterval);
    showEndOfDaySummary();
  }
}

function showEndOfDaySummary() {
  const completed = schedule.filter(t => t.status === 'completed');
  const missed    = schedule.filter(t => t.status !== 'completed');
  const pct       = Math.round((completed.length / schedule.length) * 100);

  $summaryContent.innerHTML = `
    <div class="summary-grid" style="margin-bottom:1rem">
      <div class="summary-stat"><div class="num">${completed.length}</div><div class="lbl">done</div></div>
      <div class="summary-stat"><div class="num">${missed.length}</div><div class="lbl">missed</div></div>
    </div>
    <div class="summary-grid" style="margin-bottom:1rem">
      <div class="summary-box">
        <h3>Completed</h3>
        <ul>${completed.length ? completed.map(t => `<li class="done">✓ ${t.name}</li>`).join('') : '<li style="color:var(--muted)">—</li>'}</ul>
      </div>
      <div class="summary-box">
        <h3>Missed</h3>
        <ul>${missed.length ? missed.map(t => `<li class="miss">${t.name}</li>`).join('') : '<li style="color:var(--green)">Nothing — great day!</li>'}</ul>
      </div>
    </div>
    <div class="completion-bar-wrap"><div class="completion-bar" style="width:${pct}%"></div></div>
    <p class="completion-text">You completed <strong>${pct}%</strong> of your day.</p>
  `;

  $summaryCard.classList.remove('hidden');
  playAlarm('start');
  showToast('🏁 Day complete! Check your summary.', 8000);
}

// ── Load existing schedule ────────────────────────────────────────────────────
async function loadSchedule() {
  try {
    const res  = await fetch(`${API}/tasks`);
    const data = await res.json();
    // Only restore dashboard if there's a valid dated schedule
    if (data.date && data.tasks && data.tasks.length > 0) {
      schedule = data.tasks;
      showDashboard();
    } else {
      showInput(); // new day or fresh start — go to input
    }
  } catch {
    showToast('⚠️ Cannot reach server. Make sure it\'s running.', 6000);
  }
}

// ── Show/hide views ───────────────────────────────────────────────────────────
function showDashboard() {
  $inputPanel.classList.add('hidden');
  $dashboard.classList.remove('hidden');
  renderTimetable();
  updateStatusCards();
  scheduleAlarms();
  startTicker();
}

function showInput() {
  $dashboard.classList.add('hidden');
  $summaryCard.classList.add('hidden');
  $inputPanel.classList.remove('hidden');
  $taskInput.value = '';
  dayEnded = false;
}

// ── Event listeners ───────────────────────────────────────────────────────────
$btnGenerate.addEventListener('click', async () => {
  const raw = $taskInput.value.trim();
  if (!raw) { showToast('Please enter at least one task.'); return; }

  const tasks = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if (tasks.length === 0) { showToast('No valid tasks found.'); return; }
  if (tasks.length > 8)   { showToast('Max 8 tasks per day. Extra tasks removed.'); }

  try {
    const res  = await fetch(`${API}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks })
    });
    const data = await res.json();
    if (data.error) { showToast(`Error: ${data.error}`); return; }
    schedule = data.tasks;
    showDashboard();
  } catch {
    showToast('⚠️ Server unreachable. Is it running?');
  }
});

$btnReset.addEventListener('click', async () => {
  if (!confirm('Reset today\'s schedule?')) return;
  clearTimers();
  clearInterval(tickInterval);
  await fetch(`${API}/tasks`, { method: 'DELETE' }).catch(() => {});
  schedule = [];
  showInput();
});

$btnNewDay.addEventListener('click', async () => {
  clearTimers();
  clearInterval(tickInterval);
  await fetch(`${API}/tasks`, { method: 'DELETE' }).catch(() => {});
  schedule = [];
  showInput();
});

// Mark task completed on row click
$timetable.addEventListener('click', async (e) => {
  const row = e.target.closest('.task-row');
  if (!row) return;
  const id = parseInt(row.id.replace('task-row-', ''), 10);
  const task = schedule.find(t => t.id === id);
  if (!task || task.status === 'completed') return;

  task.status = 'completed';
  await fetch(`${API}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'completed' })
  }).catch(() => {});
  renderTimetable();
  showToast(`✅ "${task.name}" marked complete!`);
});

// ── Boot ──────────────────────────────────────────────────────────────────────
startClock();
loadSchedule();
