# Shipping to the app stores

Thrusterz is a static web game (HTML, CSS, canvas, no build step, no
network at runtime), which is the easiest kind of thing to wrap as a native
app. This is the plan and the checklist.

## Wrapper: Capacitor

[Capacitor](https://capacitorjs.com) puts the web files inside a native iOS
and Android shell (WKWebView / Android WebView) and produces normal Xcode and
Android Studio projects.

```sh
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init Thrusterz com.<you>.thrusterz --web-dir www
# copy index.html, css/, js/, fonts/, img/, icon.svg into www/ (a small copy script)
npx cap add ios && npx cap add android
npx cap open ios        # build, run on a device, archive, upload
```

Native settings to make in those projects:

- **Orientation:** landscape only (Info.plist `UISupportedInterfaceOrientations`,
  Android `screenOrientation="sensorLandscape"`). The in-game "rotate your
  phone" screen then never appears.
- **Status bar:** hidden; full-screen layout. The HUD already respects the
  safe areas (notch, home bar).
- **Fullscreen gate:** already handled. Inside Capacitor the game counts as
  fullscreen (`nativeApp()` in `js/game.js`), so it never asks.

## What's already in place

- **Offline:** everything is bundled, including the fonts (`fonts/`). The
  game makes no network requests.
- **Error containment:** the game loop survives a failing frame, and a bug
  that keeps firing pauses the mission with a restart prompt instead of
  freezing.
- **Bad state:** a numerical blow-up ends the mission cleanly; corrupted or
  old saved progress is repaired on load.
- **Performance:** physics and the predicted path have per-frame time
  budgets; time warp steps down by itself if a phone can't keep up.
  `?debug` shows fps and script time per frame.
- **Touch:** buttons work while another finger is down; held controls are
  released whenever a menu covers them.
- **Tests:** `npm test` (physics, levels, a winning flight plan for every
  World 2 mission) and `npm run test:browser` (every mission under random
  input in headless Chromium, two-finger taps, corrupted saves) run on every
  push via GitHub Actions.

## Still to do before submitting

- [ ] **Durable saves.** WebView `localStorage` can be cleared by the OS
      under storage pressure. Store progress with `@capacitor/preferences`
      (keep localStorage for the web build).
- [ ] **Test on real devices**, especially an older iPhone and a mid-range
      Android, with `?debug` on. Headless tests can't measure GPU drawing.
- [ ] **App icon and splash:** render a 1024×1024 icon (no transparency for
      iOS) from `icon.svg` with `tools/brand/render.js`; splash screens.
- [ ] **Store listing:** screenshots (landscape phone and tablet), description,
      age rating, category (Games › Simulation / Puzzle).
- [ ] **Privacy:** the game collects nothing, so the privacy label is "Data
      not collected"; you still need a short privacy policy URL. This changes
      if leaderboards (accounts, scores) are added.
- [ ] **Accounts:** Apple Developer Program (USD 99/year), Google Play
      Console (USD 25 once).
- [ ] **Nice to have:** haptics on burn/crash (`@capacitor/haptics`), sound,
      pause on app background (already pauses on `visibilitychange`).

Apple's guideline 4.2 (minimum functionality) rejects thin website wrappers;
a complete offline game with native-feeling controls is fine.
