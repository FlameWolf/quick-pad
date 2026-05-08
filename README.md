# QuickPad

A simple, fast, offline-first note-taking web app built with Vue 3 and TypeScript.

QuickPad keeps your notes in your browser, works without an Internet connection, and can optionally sync to your own Google Drive when you sign in.

## Features

### Notes

- Create, view, edit, and delete plain-text notes from a tile-based dashboard.
- Each note shows title, last-updated date, and a short summary preview.
- Live word, sentence, and character counts while reading or editing.
- Per-note undo / redo history while editing (up to 100 steps).
- "Confirm to delete" guard to prevent accidental deletions.

### Organisation

- Sort notes by **Updated**, **Created**, **Title**, or **Character count**, ascending or descending.
- Sort preference is remembered between sessions.
- Multi-select mode: tap **Select**, pick notes (or **Select All**), then bulk-export.

### Import / Export

- Import any plain-text file as a new note (file type is sniffed before import; unsupported files are reported).
- Export a single note as a `.txt` file.
- Export selected notes or **Export All** as a `quick-pad-notes.zip` archive (powered by JSZip), with collisions in titles automatically de-duplicated.

### Offline / PWA

- Installable as a Progressive Web App (standalone display, custom theme colour, app icon).
- Service worker caches the app shell so it loads and works offline after the first visit.
- All notes are stored in `localStorage` — no account required to use the app.

### Theme

- Automatically follows your OS light/dark preference via `prefers-color-scheme`, switching the Bootstrap theme on the fly.

### Optional Google Drive sync

- Sign in with Google to back up notes to your Drive's app-data folder (the app cannot see any other files in your Drive).
- **Save to Drive** / **Load from Drive** on demand, plus an **Auto-sync** toggle that debounces writes a few seconds after each change.
- Status indicator shows syncing, last-synced time, or sync errors.
- Sessions are restored on reload; sign out revokes the access token.
- If no Google client ID is configured, the sync UI stays hidden and the app runs in local-only mode.

## Tech stack

- [Vue 3](https://vuejs.org/) (`<script setup>`, Composition API)
- [TypeScript](https://www.typescriptlang.org/)
- [Pinia](https://pinia.vuejs.org/) for state
- [Vue Router](https://router.vuejs.org/)
- [Bootstrap 5](https://getbootstrap.com/) + [bootstrap-vue-next](https://bootstrap-vue-next.github.io/bootstrap-vue-next/) + [Bootstrap Icons](https://icons.getbootstrap.com/)
- [JSZip](https://stuk.github.io/jszip/) for archive export
- [Vite](https://vitejs.dev/) build tooling

## Getting started

### Prerequisites

- Node.js `^20.19.0` or `>=22.12.0`
- npm

### Install

```sh
npm install
```

### Development server

```sh
npm run dev
```

### Type-check and build for production

```sh
npm run build
```

### Preview the production build

```sh
npm run preview
```

### Format source files

```sh
npm run format
```

## Configuration

Google Drive sync is optional. To enable it, create a Google OAuth 2.0 Client ID (Web application) and put it in a `.env` file at the project root:

```env
VITE_GOOG_OAUTH_CLIENT_ID="your-client-id.apps.googleusercontent.com"
```

The app requests the `drive.appdata`, `openid`, `email`, and `profile` scopes. Notes are stored as `quick-pad-notes.json` in the Drive app-data folder, which is private to QuickPad.

If the client ID is left blank, the sync controls are hidden and the app works entirely offline.

## Routes

| Path         | View                  |
| ------------ | --------------------- |
| `/notes`     | Note list / dashboard |
| `/notes/new` | Create a new note     |
| `/notes/:id` | View / edit a note    |

## Data storage

| Key                        | Purpose                                 |
| -------------------------- | --------------------------------------- |
| `quick-pad-notes`          | All notes (JSON array)                  |
| `quick-pad-sort-by`        | Sort field preference                   |
| `quick-pad-sort-direction` | Sort direction preference               |
| `quick-pad-last-synced`    | Timestamp of last successful Drive sync |
| `quick-pad-auto-sync`      | Auto-sync on/off                        |
| `google_*`                 | Google session, token, and user info    |

Clearing site data will remove all notes that have not been synced to Drive.