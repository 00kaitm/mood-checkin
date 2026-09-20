import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, setDoc,
  onSnapshot, terminate, clearIndexedDbPersistence,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const TIME_KEY = 'reminderTime';
const LOCK_AFTER_MS = 30000; // re-lock after 30 s in the background
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
const form = $('form'), note = $('note'), timeInput = $('time');

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function store(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

// ---- Setup check ----
const configured = !String(firebaseConfig.apiKey).startsWith('PASTE');
let auth, db;
if (configured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} else {
  show('auth');
  $('authForm').hidden = true;
  $('setupWarn').hidden = false;
  $('setupWarn').textContent = 'Setup needed: paste your Firebase config into firebase-config.js (see README).';
}

function show(which) {
  $('auth').hidden = which !== 'auth';
  $('lock').hidden = which !== 'lock';
  $('app').hidden = which !== 'app';
}

// Local date as YYYY-MM-DD (not UTC, so "today" matches the phone's clock).
function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function quoteForToday() {
  const d = new Date();
  const dayNumber = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
  return QUOTES[dayNumber % QUOTES.length];
}

// ---- Auth ----
const authStatus = $('authStatus');
const AUTH_ERRORS = {
  'auth/invalid-email': 'That email address does not look right.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/email-already-in-use': 'An account with that email already exists. Try signing in.',
  'auth/weak-password': 'Please use a password with at least 8 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
};
function authError(e) { authStatus.textContent = AUTH_ERRORS[e.code] || 'Something went wrong. Please try again.'; }

$('authForm').addEventListener('submit', async e => {
  e.preventDefault();
  authStatus.textContent = 'Signing in…';
  try { await signInWithEmailAndPassword(auth, $('email').value.trim(), $('password').value); } catch (err) { authError(err); }
});
$('signUp').addEventListener('click', async () => {
  if (!$('authForm').reportValidity()) return;
  authStatus.textContent = 'Creating account…';
  try { await createUserWithEmailAndPassword(auth, $('email').value.trim(), $('password').value); } catch (err) { authError(err); }
});
$('forgot').addEventListener('click', async () => {
  const email = $('email').value.trim();
  if (!email) { authStatus.textContent = 'Type your email above first.'; return; }
  try { await sendPasswordResetEmail(auth, email); } catch { /* do not reveal whether the account exists */ }
  authStatus.textContent = 'If that email has an account, a reset link is on its way.';
});

async function fullSignOut() {
  // Clear the offline copy of the entries too, so the next person on this phone cannot see them.
  await signOut(auth);
  try { await terminate(db); await clearIndexedDbPersistence(db); } catch { /* best effort */ }
  location.reload();
}
$('signOut').addEventListener('click', fullSignOut);
$('lockSignOut').addEventListener('click', fullSignOut);

// ---- Entries (one Firestore document per day: users/<uid>/checkins/<YYYY-MM-DD>) ----
let user = null;
let entries = [];
let unsubscribe = null;

function startListening() {
  unsubscribe?.();
  unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'checkins'), snap => {
    entries = snap.docs.map(d => d.data());
    render();
  }, () => { $('status').textContent = 'Could not load your history. Check your connection.'; });
}

function render() {
  $('quote').textContent = quoteForToday();
  const today = entries.find(e => e.date === dayKey());
  if (today && !form.dataset.touched) {
    form.elements.mood.value = today.mood;
    note.value = today.note;
  }
  $('save').textContent = today ? "Update today's check-in" : "Save today's check-in";
  $('prompt').textContent = today ? "Today's check-in" : 'How are you feeling today?';
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

form.addEventListener('input', () => { form.dataset.touched = '1'; });
form.addEventListener('submit', async e => {
  e.preventDefault();
  const mood = Number(form.elements.mood.value);
  if (!mood || !user) return;
  const date = dayKey();
  $('status').textContent = 'Saving…';
  try {
    // Offline, this resolves from the local cache and syncs later, so do not wait on the server.
    const write = setDoc(doc(db, 'users', user.uid, 'checkins', date),
      { date, mood, note: note.value.trim(), updatedAt: Date.now() });
    $('status').textContent = navigator.onLine ? 'Saved. Thanks for checking in 💜' : 'Saved on this phone. It will sync when you are online.';
    form.dataset.touched = '';
    await write;
  } catch {
    $('status').textContent = 'Could not save. Please try again.';
  }
});

// ---- Export ----
function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheets treating text as a formula
  return `"${s.replace(/"/g, '""')}"`;
}
$('export').addEventListener('click', async () => {
  const rows = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const csv = ['date,mood,note', ...rows.map(r => [r.date, r.mood, r.note].map(csvCell).join(','))].join('\r\n');
  const file = new File(['﻿' + csv], 'checkin-history.csv', { type: 'text/csv' });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; }
  } catch (err) { if (err.name === 'AbortError') return; }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = file.name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});

// ---- Face ID / fingerprint lock (WebAuthn platform authenticator) ----
// This is a screen lock for the app on this phone. The real protection of the data is the account
// login and the server rules; the lock stops someone from browsing the app on an unlocked phone.
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const rand = n => crypto.getRandomValues(new Uint8Array(n));
const lockKey = () => `lockCred:${user.uid}`;
const lockSupported = () => !!(window.PublicKeyCredential && navigator.credentials);

function updateLockUi() {
  const on = !!load(lockKey(), null);
  $('lockToggle').textContent = on ? 'Turn off Face ID / fingerprint lock' : 'Turn on Face ID / fingerprint lock';
  $('lockToggle').hidden = !lockSupported();
  $('lockInfo').textContent = on ? 'The app locks when you open it and after 30 seconds away.' : '';
}

$('lockToggle').addEventListener('click', async () => {
  if (load(lockKey(), null)) {
    try { await verifyLock(); } catch { $('lockInfo').textContent = 'Could not verify. The lock is still on.'; return; }
    try { localStorage.removeItem(lockKey()); } catch { /* ignore */ }
    updateLockUi();
    return;
  }
  try {
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: rand(32),
      rp: { name: 'Daily Check-in', id: location.hostname },
      user: { id: new TextEncoder().encode(user.uid), name: user.email, displayName: user.email },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
    } });
    store(lockKey(), b64(cred.rawId));
    updateLockUi();
  } catch {
    $('lockInfo').textContent = 'Could not turn on the lock. Make sure Face ID or a passcode is set up on this phone.';
  }
});

async function verifyLock() {
  const id = load(lockKey(), null);
  await navigator.credentials.get({ publicKey: {
    challenge: rand(32),
    rpId: location.hostname,
    allowCredentials: [{ type: 'public-key', id: unb64(id), transports: ['internal'] }],
    userVerification: 'required',
    timeout: 60000,
  } });
}

let locked = false;
function lockApp() {
  if (!user || !load(lockKey(), null)) return;
  locked = true;
  show('lock');
}
async function tryUnlock() {
  try {
    await verifyLock();
    locked = false;
    $('lockStatus').textContent = '';
    show('app');
  } catch {
    $('lockStatus').textContent = 'Could not unlock. Tap Unlock to try again.';
  }
}
$('unlock').addEventListener('click', tryUnlock);

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (!locked && hiddenAt && Date.now() - hiddenAt > LOCK_AFTER_MS) lockApp();
  checkReminder();
});

// ---- Reminders ----
// iPhone web apps cannot schedule notifications while closed (that needs a push server). The
// Calendar reminder is the reliable daily alert; notifications show when the app is opened after
// the chosen time.
timeInput.value = load(TIME_KEY, '20:00');
timeInput.addEventListener('change', () => { store(TIME_KEY, timeInput.value); checkReminder(); });
const notificationsSupported = () => 'Notification' in window;

$('notify').addEventListener('click', async () => {
  if (!notificationsSupported()) {
    $('notifyStatus').textContent = 'Notifications need the app added to your Home Screen (iOS 16.4+).';
    return;
  }
  await Notification.requestPermission();
  updateNotifyUi();
  checkReminder();
});

function updateNotifyUi() {
  if (!notificationsSupported()) {
    $('notify').disabled = true;
    $('notifyStatus').textContent = 'Open the app from your Home Screen to enable notifications.';
  } else if (Notification.permission === 'granted') {
    $('notify').textContent = 'On';
    $('notifyStatus').textContent = 'Reminders show when you open the app after this time.';
  } else if (Notification.permission === 'denied') {
    $('notifyStatus').textContent = 'Notifications are blocked. Enable them in iPhone Settings > Notifications.';
  }
}

async function checkReminder() {
  if (!notificationsSupported() || Notification.permission !== 'granted' || locked || !user) return;
  const [h, m] = timeInput.value.split(':').map(Number);
  const now = new Date();
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
  if (load('lastNotified', '') === dayKey()) return;
  store('lastNotified', dayKey());
  const reg = await navigator.serviceWorker.getRegistration();
  const options = { body: quoteForToday(), icon: 'icon-192.png' };
  if (reg) reg.showNotification('Daily check-in', options); else new Notification('Daily check-in', options);
}

$('ics').addEventListener('click', () => {
  const [h, m] = timeInput.value.split(':');
  const stamp = `${dayKey().replace(/-/g, '')}T${h}${m}00`;
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

// ---- Start ----
if (configured) {
  onAuthStateChanged(auth, u => {
    user = u;
    if (!u) {
      unsubscribe?.(); unsubscribe = null; entries = []; locked = false;
      show('auth');
      authStatus.textContent = '';
      $('password').value = '';
      return;
    }
    $('who').textContent = `Signed in as ${u.email}`;
    updateLockUi();
    startListening();
    show('app');
    lockApp();
    if (locked) tryUnlock();
    updateNotifyUi();
    checkReminder();
  });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
