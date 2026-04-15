const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, '../data/tasks.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Rule-based scheduler
 * Start: 08:00 | Slot: 60 min | Break: 10 min | Max: 8 tasks
 */
function buildSchedule(taskNames) {
  const capped = taskNames.slice(0, 8);
  let cursor = 8 * 60; // minutes since midnight
  const schedule = [];

  capped.forEach((name, i) => {
    const start = minutesToTime(cursor);
    cursor += 60;
    const end = minutesToTime(cursor);

    schedule.push({
      id: i + 1,
      name: name.trim(),
      start,
      end,
      startMinutes: cursor - 60,
      endMinutes: cursor,
      status: 'pending' // pending | active | completed | missed
    });

    cursor += 10; // break
  });

  return schedule;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { date: '', tasks: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET current schedule
app.get('/api/tasks', (req, res) => {
  const data = readData();
  // Reset if it's a new day
  if (data.date !== todayStr()) {
    const fresh = { date: todayStr(), tasks: [] };
    writeData(fresh);
    return res.json(fresh);
  }
  res.json(data);
});

// POST new task list → generate schedule
app.post('/api/tasks', (req, res) => {
  const { tasks } = req.body;
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: 'Provide a non-empty tasks array.' });
  }

  const schedule = buildSchedule(tasks);
  const data = { date: todayStr(), tasks: schedule };
  writeData(data);
  res.json(data);
});

// PATCH single task status
app.patch('/api/tasks/:id', (req, res) => {
  const data = readData();
  const id = parseInt(req.params.id, 10);
  const { status } = req.body;
  const task = data.tasks.find(t => t.id === id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  task.status = status;
  writeData(data);
  res.json(task);
});

// DELETE all tasks (reset day)
app.delete('/api/tasks', (req, res) => {
  const fresh = { date: todayStr(), tasks: [] };
  writeData(fresh);
  res.json(fresh);
});

app.listen(PORT, () => {
  console.log(`\n✅  DTS Server running → http://localhost:${PORT}\n`);
});
