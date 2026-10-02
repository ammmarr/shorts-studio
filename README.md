# Tabeba's workspace

A small app (مساحة طبيبة) for making animated, on-brand YouTube Shorts for a faceless doctor's
channel. She writes (or asks the AI for) a script, reads it aloud once, and gets a finished
1080×1920 video with animation, icons, her photo and word-by-word captions that follow her voice.
The app's screens are in Arabic and English (switch at the top right).

**7 animation styles**: Cards, Whiteboard (a hand writes it out), Photo story (her photos full
screen), Prescription (tips written on her Rx pad and ticked off), Bold words (kinetic captions),
Quiz (true/false with a countdown) and Editorial (a calm magazine page: big type, thin rules,
lots of space). **5 colour schemes**: Clean clinic, Bold night, Warm &
friendly, Sky blue, Blush. Arabic videos use Cairo; English uses Poppins (Caveat for the
whiteboard handwriting).

- **A photo on any card** (it replaces the icon), shrunk on the phone before uploading.
- **Captions at the top, the bottom, or off**, so they never cover something.
- **Voice disguise**: the same recording moved up or down in pitch (same words, same timing) so it
  sounds less like her. Her original is kept; captions are made from the original.
- **YouTube's buttons are accounted for**: everything important stays inside a centred safe box
  (see `src/shared/layout.ts`), clear of the top bar, the like/comment column (right side, or left
  for viewers whose YouTube is in Arabic) and the title/Subscribe area. The preview can show a
  mock of YouTube's buttons on top of the video.

Everything runs on her own computer. The only paid part is the optional AI script writer
(about 5 cents a script).

## For the person using it

1. Double-click **Start Tabeba's workspace.bat**. A black window opens (keep it open) and the browser opens by itself.
2. The first time, set up **My channel**: your name, handle, photo, languages, and the default style and colours. It saves by itself.
3. Click **New Short** and follow the 4 steps:
   - **Idea**: say what you want to teach, pick a type (tips, myth vs fact, Q&A) and the language.
   - **Script**: check each card. Big text on screen + what you'll say. Read the "Doctor's check" list.
   - **Voice**: read the script aloud (or upload a recording from your phone). Captions appear by themselves; fix any misheard word.
   - **Video**: choose the animation style, where the captions go and the colours, click **Create my video**, then **Share** or **Download**. Copy the title and description for YouTube.
4. Close the black window when you're done. Everything is saved automatically.

## Setup (once, on her computer)

Needs Windows 10/11 and [Node.js](https://nodejs.org) 22 or newer.

```bash
npm install
npm run setup
```

`npm run setup` downloads the caption engine ([whisper.cpp](https://github.com/ggml-org/whisper.cpp),
~10 MB), its multilingual speech model (`large-v3-turbo-q5_0`, ~575 MB), the Lucide icon library
(~1 MB) and the headless browser Remotion renders with. The launcher runs it automatically, so you can also just double-click
`Start Tabeba's workspace.bat`.

To turn on **Write my script**, copy `.env.example` to `.env` and add an Anthropic API key
(console.anthropic.com → API keys, prepaid credit). Without a key she can still write scripts herself.

## Phone app (Android APK)

The phone app contains the app's screens; the computer above still does the heavy work (captions
and video rendering), so it must be switched on with Tabeba's workspace running.

1. On the computer, open **My channel**: the "Use it on your phone" box shows the address, e.g.
   `192.168.1.19:3100`. (The black window prints it too.) The first time, Windows asks whether
   Node.js may use the network: allow it on **private networks**.
2. Install the APK on the phone, open it and type that address. The phone must be on the same
   Wi-Fi. It remembers the address; **My channel → Change** switches computers.
3. When a video is ready, **Share or save** opens Android's share sheet: YouTube to post it,
   Drive or Files to keep a copy.

Building the APK: every push to GitHub runs `.github/workflows/android.yml`, which builds a signed
APK and publishes it as the `latest` release (download `Tabeba-workspace.apk` from the release page
on the phone). The signing key is **not** in the repository: it lives in `android/keystore/` +
`android/keystore.properties` on this computer (git-ignored) and in the repository secrets
`ANDROID_KEYSTORE_BASE64` / `ANDROID_KEYSTORE_PASSWORD`. Back up that folder: keep the same key, or
updates won't install over the old app. To build locally instead you need Java 21 and the
Android SDK:

```bash
npm run android:sync                      # build the screens and copy them into android/
cd android && ./gradlew assembleRelease   # → android/app/build/outputs/apk/release/app-release.apk
```

The same app also works on a cloud server later: install Tabeba's workspace there (with https in
front of it) and type its address in the phone app. Add a password first; the server has no login
because it is meant for a home network.

## Development

```bash
npm run dev        # API on :3100 + Vite UI on :5190 (open http://localhost:5190)
npm test           # timeline/caption logic tests
npm run typecheck
npm run still -- Short out.png --props=props.json --frame=60   # render one frame of the template
npx remotion studio src/remotion/index.ts                      # tweak the video template visually
```

In dev mode each render re-bundles the video template, so template edits show up without a restart.

## How it works

| Part | Where | Notes |
|---|---|---|
| Video templates | `src/remotion/templates/` | Remotion (React → MP4). One file per animation style; every style renders the same scene kinds (hook, point, myth, fact, ending). Colour schemes in `src/shared/themes.ts`; positions (safe zone, caption place) in `src/shared/layout.ts`. |
| Voice disguise | `server/voice.ts` | ffmpeg (the copy that ships with Remotion): `asetrate` + `aresample` + `atempo` moves the pitch by ±1.5 or ±3 semitones and keeps the length, so caption timing still matches. |
| Phone app | `capacitor.config.json`, `android/`, `src/web/server.ts` | Capacitor 8. The APK serves the screens from `http://localhost`; the server allows that origin (CORS) and every API/media URL is prefixed with the saved computer address. |
| Icons | `server/icons.ts` | The full Lucide set (~1,850 icons) is downloaded once from the jsDelivr CDN (`lucide-static` data files, plus categories from lucide.dev) and cached in `data/cache/`. Nothing is installed or bundled. The server searches names, tags and categories (Arabic words are mapped to English tags in `src/shared/iconKeywords.ts`) and sends the SVG drawings with each video, so renders work offline once an icon has been used. The hand-picked health icons also have built-in fallbacks. |
| Translations | `src/web/i18n.ts` | Every screen string in English and Arabic; the app switches direction (RTL) with the language. |
| Timing | `src/shared/timeline.ts` | Turns a project + channel settings into video props: scene start times from the voice, caption pages, script-based caption clean-up. Shared by the preview and the renderer. |
| Editor UI | `src/web/` | React + Vite. The live preview is the same template in `@remotion/player`. Audio is cleaned in the browser (mono 48 kHz, silence trimmed, volume evened). |
| Server | `server/` | Express. Stores projects as JSON in `data/`, runs captions (whisper.cpp) and renders (Remotion) as background jobs, calls Claude for scripts. |

Scene timing: the recording is transcribed with word timestamps; each card starts where its first
narration word is spoken (script word counts are mapped proportionally onto the transcript, so small
ad-libs don't break sync). Where the spoken words match the script, captions use the script's exact
spelling and punctuation.

Data lives in `data/` (projects, recordings, logos, finished videos in `data/renders/`). Deleted
Shorts go to `data/trash/`. Back up `data/` if the videos matter.

## Costs and licenses

- Claude API: only for "Write my script", about $0.05 per script (Claude Opus 5). Uses server-side
  refusal fallbacks (`fallbacks: "default"`), so a rare safety-classifier decline is retried on
  Anthropic's recommended fallback model automatically.
- Remotion: free for individuals and companies of up to 3 people (rendering passes `licenseKey: 'free-license'`). See remotion.dev/license.
- whisper.cpp and the speech model: MIT, free.
- Lucide icons: ISC, free.
- Background music: only upload tracks she has the rights to (e.g. YouTube Audio Library).
