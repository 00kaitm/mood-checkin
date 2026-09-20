# PracticeApple: Daily Check-in

An installable PWA for iPhone (no Mac or App Store needed). Pick a mood from 1 to 5,
write how you feel, and get a daily reminder. Data is stored only on the phone (localStorage).

## Run locally
    npx serve .
Then open http://localhost:3000

## Install on iPhone
Host over HTTPS (GitHub Pages), open the URL in Safari, tap Share > Add to Home Screen.

## Reminders
- iPhones cannot run scheduled notifications for a closed PWA without a push server.
- The reliable daily alert is the "Add a daily reminder to Calendar" button, which downloads a
  repeating calendar event with an alert at the chosen time.
- If notifications are enabled, the app also shows the day's motivational quote as a notification
  when it is opened after the chosen time.

## Development notes
- All paths are relative (`./`) so the app works under a GitHub Pages sub-path (`/<repo>/`).
- If you change any cached file, bump `CACHE` in `sw.js` so phones refresh.
