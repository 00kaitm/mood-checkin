const ENTRIES_KEY = 'checkins';
const TIME_KEY = 'reminderTime';
const NOTIFY_KEY = 'notifyOn';
const FACES = ['', '😞', '😕', '😐', '🙂', '😄'];
const QUOTES = [
  'Small steps still move you forward.',
  'You are allowed to take up space today.',
  'Be as kind to yourself as you are to your friends.',
  'Hard days end. You have gotten through every one so far.',
  'Progress, not perfection.',
  'Rest is productive too.',
  'You are doing better than you think.',
  'One good thing today is enough.',
  'Your feelings are valid, whatever they are.',
  'Today is a fresh page.',
  'Breathe in. You have got this.',
  'Being honest about how you feel is a strength.',
];

const $ = id => document.getElementById(id);
const form = $('form'), note = $('note'), status = $('status'), timeInput = $('time');
const notifyBtn = $('notify'), notifyStatus = $('notifyStatus');

let entries = load(ENTRIES_KEY, []);

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function store(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

// Local date as YYYY-MM-DD (not UTC, so "today" matches the phone's clock).
function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Same quote all day, a different one tomorrow.
function quoteForToday() {
  const d = new Date();
  const dayNumber = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
  return QUOTES[dayNumber % QUOTES.length];
}

function render() {
  $('quote').textContent = quoteForToday();
  const today = entries.find(e => e.date === dayKey());
  if (today) {
    form.elements.mood.value = today.mood;
    note.value = today.note;
    $('save').textContent = "Update today's check-in";
    $('prompt').textContent = "Today's check-in";
  }
  const list = $('history');
  list.innerHTML = '';
  [...entries].sort((a, b) => b.date.localeCompare(a.date)).forEach(e => {
    const li = document.createElement('li');
    const top = document.createElement('div');
    top.className = 'top';
    const date = document.createElement('span');
    date.textContent = new Date(e.date + 'T00:00').toLocaleDateString(undefined,
      { weekday: 'short', month: 'short', day: 'numeric' });
    const face = document.createElement('b');
    face.textContent = `${FACES[e.mood]} ${e.mood}/5`;
    top.append(date, face);
    li.append(top);
    if (e.note) {
      const p = document.createElement('p');
      p.textContent = e.note;
      li.append(p);
    }
    list.append(li);
  });
  $('empty').hidden = entries.length > 0;
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const mood = Number(form.elements.mood.value);
  if (!mood) return;
  const entry = { date: dayKey(), mood, note: note.value.trim() };
  const i = entries.findIndex(x => x.date === entry.date);
  if (i >= 0) entries[i] = entry; else entries.push(entry);
  store(ENTRIES_KEY, entries);
  status.textContent = 'Saved. Thanks for checking in 💜';
  render();
});

// ---- Reminders ----
// iPhone PWAs cannot schedule notifications by themselves while closed (that needs a push
// server). So: (1) the Calendar reminder below is the reliable daily alert, and
// (2) if notifications are enabled, we also show one when the app is opened after the chosen time.
timeInput.value = load(TIME_KEY, '20:00');
timeInput.addEventListener('change', () => { store(TIME_KEY, timeInput.value); checkReminder(); });

function notificationsSupported() { return 'Notification' in window; }

notifyBtn.addEventListener('click', async () => {
  if (!notificationsSupported()) {
    notifyStatus.textContent = 'Notifications need the app added to your Home Screen (iOS 16.4+).';
    return;
  }
  const result = await Notification.requestPermission();
  store(NOTIFY_KEY, result === 'granted');
  updateNotifyUi();
  if (result === 'granted') checkReminder();
});

function updateNotifyUi() {
  if (!notificationsSupported()) {
    notifyBtn.disabled = true;
    notifyStatus.textContent = 'Open the app from your Home Screen to enable notifications.';
  } else if (Notification.permission === 'granted') {
    notifyBtn.textContent = 'On';
    notifyStatus.textContent = 'Reminders show when you open the app after this time.';
  } else if (Notification.permission === 'denied') {
    notifyStatus.textContent = 'Notifications are blocked. Enable them in iPhone Settings > Notifications.';
  }
}

async function checkReminder() {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const [h, m] = timeInput.value.split(':').map(Number);
  const now = new Date();
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
  if (load('lastNotified', '') === dayKey()) return;
  store('lastNotified', dayKey());
  const reg = await navigator.serviceWorker.getRegistration();
  const title = 'Daily check-in';
  const options = { body: quoteForToday(), icon: 'icon-192.png' };
  if (reg) reg.showNotification(title, options); else new Notification(title, options);
}

// Daily repeating Calendar event with an alert at the chosen time. Works while the app is closed.
$('ics').addEventListener('click', () => {
  const [h, m] = timeInput.value.split(':');
  const d = new Date();
  const stamp = `${dayKey(d).replace(/-/g, '')}T${h}${m}00`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Daily Check-in//EN',
    'BEGIN:VEVENT',
    `UID:daily-checkin-${Date.now()}@practiceapple`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${stamp}`,
    'DURATION:PT10M',
    'RRULE:FREQ=DAILY',
    'SUMMARY:Daily check-in 💜',
    'DESCRIPTION:How are you feeling today? Take a minute to check in.',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Daily check-in', 'TRIGGER:PT0S', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'daily-checkin.ics';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});

render();
updateNotifyUi();
checkReminder();
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminder(); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
