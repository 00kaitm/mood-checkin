# PracticeApple: Daily Check-in

An installable PWA for iPhone (no Mac or App Store needed). Sign in, pick a mood from 1 to 5,
write how you feel, and get a daily reminder. Check-ins are saved privately online per account
(Firebase Auth + Firestore, free Spark plan).

## Run locally
    npx serve .
Then open http://localhost:3000

## One-time Firebase setup (free, no credit card)
1. Go to https://console.firebase.google.com and create a project (turn Google Analytics off).
2. **Build > Authentication > Get started > Email/Password > Enable.**
3. **Build > Firestore Database > Create database.** Choose a location near you and
   **Production mode**.
4. Firestore > **Rules** tab: replace the contents with `firestore.rules` from this repo and **Publish**.
5. **Project settings (gear) > Your apps > Web (`</>`)**: register an app, then copy the config values
   into `firebase-config.js`.
6. **Authentication > Settings > Authorized domains > Add domain:** `00kaitm.github.io`.
7. Bump `CACHE` in `sw.js`, commit, and `git push`.

## Install on iPhone
Open the GitHub Pages URL in Safari, tap Share > Add to Home Screen, then open it from the icon.

## Privacy and security
- Firestore rules let a signed-in user read and write only `users/<their uid>/checkins/*`.
- The Firebase config values are public identifiers, not secrets. The rules are the protection.
- Face ID / fingerprint lock is a screen lock on the phone (WebAuthn). The account login and the
  server rules are what actually protect the data.
- Signing out clears the offline copy of the entries from the phone.
- The project owner can technically read all data in the Firebase console. Only give the link to
  people who are comfortable with that, or tell them.

## Reminders
- iPhones cannot run scheduled notifications for a closed PWA without a push server.
- The reliable daily alert is the "Add a daily reminder to Calendar" button (repeating event).
- If notifications are enabled, the app also shows the day's quote when opened after the chosen time.

## Development notes
- All paths are relative (`./`) so the app works under a GitHub Pages sub-path (`/<repo>/`).
- If you change any cached file, bump `CACHE` in `sw.js` so phones refresh.
