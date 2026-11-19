# Vanilla Web Foundations

A free, self-paced web development course that runs entirely in the browser — lessons with interactive demos and audio summaries, graded quizzes, eight coding labs with an in-browser editor, and a signed certificate. Live at [druba.in/learn](https://druba.in/learn/).

No framework and no build step for the app itself: plain ES modules, served as static files. Progress lives in the learner's own browser (IndexedDB); the only server call is the Cloudflare Worker that signs certificates.

## Run it locally

Serve the folder with any static server and open it, e.g. VS Code Live Server on `http://localhost:5500`.

```bash
npm test
```

runs the unit tests (Node 20+, no dependencies).

## Course flow

Each module goes **lessons → graded quiz (60% to pass) → that module's labs → next module**. The quiz opens once every lesson in the module has been worked through. Questions and options are reshuffled on every attempt, and a failed attempt shows which questions were missed but not the answers. Finishing every quiz and lab unlocks the certificate.

## Project layout

```
index.html             app shell, dialogs
js/app.js              entry point (boot)
js/router.js           hash router
js/core/               state + gating rules, theme, small utilities
js/ui/                 sidebar, dialogs, IDE layout, shortcuts, content guard, mastery badge
assets/badge.svg       Mastery badge artwork
js/views/              one module per route: home, lesson, quiz, lab, certificate, verify, manual
js/integrity/          DevTools trail (trail.js) and its encodings (trail-format.js)
js/course-data.js      modules and lessons      js/quiz-data.js   quizzes
js/labs-data.js        labs (array order = course order)
js/ide.js              CodeMirror editor, sandboxed preview, lab checker
js/db.js               IndexedDB storage        js/crypto-key.js  certificates, .vwfd backups
tests/                 node:test unit tests
tools/                 asset pipeline (vendor sync, Tailwind build, lesson audio)
```

Gating is derived from the data: add a module or lab to `course-data.js` / `labs-data.js` and the unlock rules, progress counts and messages follow. A lab's `id` is its permanent storage key; `code` ("Lab 4") is only its display label.

## The DevTools trail and DevSec

Everything here is client-side, so a determined learner can always bend it — and that's the point. Instead of pretending otherwise, the app keeps an honest **DevTools trail** of how it was inspected:

| Signal | How it's noticed |
| --- | --- |
| DevTools shortcut | F12, Ctrl+Shift+I/J/C, ⌘⌥I/J/C, Ctrl+U |
| DevTools panel opened | window chrome suddenly takes a big strip of space (docked panel heuristic) |
| Drove the UI with JavaScript | clicks / changes / keys with `event.isTrusted === false` |
| Injected code into the editor | editor changed with no keystroke, paste or tap behind it |
| Forged a code check | lab result without the checker's per-run nonce, or a duplicate result |
| Edited saved progress | IndexedDB no longer matches the seal the app writes after every save |
| Hand-crafted a backup | `.vwfd` with a valid signature but a missing / wrong integrity seal |

The trail travels with backups and rides along (unsigned) with certificates — after `~` in the verification code and as `&t=` in the QR link. If it contains hands-on tricks, the verify page shows "Impeccable" with the parody DEV badge of **DevSec**, a pun on DedSec, the hacker collective from the Watch Dogs games (*Dev* as in developer). Its motto is "Read the source. Bend the system.", and ranks go Script Kiddie → Hacktivist → Root by how many different tricks were used. The badge also crowns the certificate, and opening DevTools greets the learner with a DevSec transmission in the console. The badge artwork is `assets/badge.svg`; replace that file to change it everywhere. It is drawn in `#6E6D7A`, which the app swaps for the theme accent on the verify page (the certificate keeps the grey); keep that colour in a replacement if you want the recolouring. Just opening DevTools shows up on the trail but doesn't earn the badge.

Text handling (`js/ui/content-guard.js`): lessons and the home page select and copy normally. Exams are selectable on desktop, but copying a question puts **"Psych!"** on the clipboard; on touch devices exams can't be selected at all, so a long-press never opens a search sheet over a question. Editors and the backup / verification code boxes always work, the rest of the app chrome can't be copied, and touch screens can't pinch-zoom. On exam pages a screenshot attempt is met with a full-screen "Psych!" on a best-effort basis. It goes up as soon as Win/⌘ + Shift are held (before Win+Shift+S or ⌘⇧3/4/5 can capture), on a three-finger touch (the usual phone screenshot swipe), and whenever the page loses focus or is hidden. Print Screen also overwrites the clipboard, and printing an exam prints only "Psych!". Power + volume screenshots on phones give the page no signal, so those can't be caught.

## Rebuilding assets

Vendor libraries, fonts and the compiled Tailwind CSS are committed. After adding Tailwind classes or Material Symbols icons, rebuild:

```bash
cd tools && npm install && npm run build:assets
```

`sync:vendors` re-downloads pinned vendor files and subsets the icon font to the icons used in `index.html` and `js/**` (icons set from data need an `icon: 'name'` field to be picked up). `build:css` recompiles `css/tailwind.css`.
