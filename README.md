# ⬡ Daily Task Scheduler (DTS)

Offline-first productivity system. Black & gold UI. No cloud, no BS.

---

## 📁 Project Structure

```
dts/
├── frontend/
│   ├── index.html     ← Main UI
│   ├── style.css      ← Black/gold theme
│   └── app.js         ← All frontend logic
├── backend/
│   └── server.js      ← Express API + scheduler logic
├── data/
│   └── tasks.json     ← Local task storage
├── package.json
└── README.md
```

---

## 🚀 How to Run

### 1. Install dependencies
```bash
cd dts
npm install
```

### 2. Start the server
```bash
npm start
```

### 3. Open the app
Open your browser → http://localhost:3000

---

## 💡 How to Use

1. **Enter tasks** — one per line (max 8)
2. **Click "Generate Schedule"** — auto-assigns time slots from 8:00 AM
3. **Watch the dashboard** — live clock, active task, countdown
4. **Alarms fire automatically** — sound + toast 1 min before & at start time
5. **Click a task row** to mark it complete
6. **End of day summary** shows at the last task's end time

---

## 🧪 Sample Tasks (paste to test)

```
Study control systems
Work on website
Exercise
Read a book
Review project notes
Plan tomorrow
```

This generates:
```
08:00 – 09:00 → Study control systems
09:10 – 10:10 → Work on website
10:20 – 11:20 → Exercise
11:30 – 12:30 → Read a book
12:40 – 13:40 → Review project notes
13:50 – 14:50 → Plan tomorrow
```

---

## ⚙️ Scheduler Rules

| Rule | Value |
|---|---|
| Day start | 08:00 AM |
| Slot duration | 60 minutes |
| Break between tasks | 10 minutes |
| Max tasks per day | 8 |

---

## 🎨 Features

- ⏰ **Alarm system** — Web Audio API (no files needed, works offline)
- 📋 **Live timetable** — colour-coded: active / pending / completed / missed
- ▶ **Active task tracker** — countdown timer
- ⏭ **Next task card** — always visible
- 🏁 **End-of-day summary** — completed vs missed + % rate
- 💾 **Persistent storage** — JSON file, survives page refresh
- 🔄 **Auto-reset** — new day = clean slate

---

## 🔧 VS Code Tips

- Install **Live Server** extension for instant reload during development
- Use **nodemon** for auto-restart: `npm run dev`
- Open `dts/` as workspace root for best experience
