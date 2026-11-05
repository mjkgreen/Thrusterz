# Shipping Thrusterz to the App Store (no Mac needed)

The iOS app is built with **Expo**: `mobile/` is a small React Native app
that runs the game full screen in a WebView. **EAS Build** compiles and
signs it in Expo's cloud (on their Macs), and **EAS Submit** uploads it to
App Store Connect. Everything below works from Windows, Linux or a browser.

What's in the app:

- The whole game bundled into one file (`tools/build-mobile.js` →
  `mobile/assets/game/game.html`, rebuilt automatically before every start
  and every EAS build), so it works fully offline.
- Landscape only, fullscreen, no status bar, iPad full screen, dark launch
  screen and app icon (`mobile/assets/`, rendered by
  `tools/brand/render-mobile.js`).
- Native storage for progress and the account (AsyncStorage, not cleared by
  iOS like web storage can be), **Sign in with Apple**, haptics, links open
  in Safari. The web side of this is `js/bridge.js`.
- Privacy manifest and "no encryption" export answer in `mobile/app.json`.

The online side (accounts, cloud save, restore codes, leaderboards with
replay-checked runs, account deletion) is the Vercel API in `api/`; see
step 1.

---

## 1. Server (Vercel)

1. In the Vercel project: **Storage → Create → Upstash for Redis** (free
   tier) and connect it to the project. Without a database the API answers
   "not set up yet" and the game simply plays offline.
2. Environment variables (Settings → Environment Variables):
   - `APPLE_CLIENT_ID` = `com.thrusterz.app` (the bundle ID, step 2)
   - `ADMIN_KEY` = any long random string. Lets you read crash reports:
     `curl -H "x-admin-key: <key>" https://thrusterz.com/api/crash`
   - `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`: from the Sign in
     with Apple key (step 2.3); paste the whole `.p8` file as the value.
     Needed so deleting an account also revokes Sign in with Apple, which
     Apple requires.
3. Redeploy (Vercel only applies new environment variables to new
   deployments; a push to `main` does it). Then
   `https://thrusterz.com/api/board?level=liftoff` should return JSON and
   `https://thrusterz.com/privacy.html` should load.
4. `js/config.js` points the app at `https://thrusterz.com`. Make
   `thrusterz.com` (not `www.`) the primary domain in Vercel, so the app's
   API calls aren't redirected.
5. The contact email in `privacy.html` is thrusterz.app@gmail.com.

## 2. Apple Developer (in the browser)

1. **Bundle ID** is `com.thrusterz.app` (`ios.bundleIdentifier` and
   `android.package` in `mobile/app.json`). It must match `APPLE_CLIENT_ID`
   on Vercel.
2. EAS registers the App ID and turns on Sign in with Apple for you during
   the first build, so there's nothing to click here for that.
3. For the server: developer.apple.com → Certificates, Identifiers &
   Profiles → **Keys → +**, enable **Sign in with Apple**, pick the App ID
   (after the first build has created it), download the `.p8` (only once),
   note the Key ID and your Team ID (top right). Add them on Vercel (1.2).

## 3. First build (any computer with Node 20+)

```sh
cd mobile
npm install
npx eas-cli login              # your Expo account
npx eas-cli init               # links this folder to an Expo project (writes the id into app.json)
npx eas-cli build -p ios --profile production
```

The first iOS build asks for your Apple ID login. Let EAS create and keep
the distribution certificate and provisioning profile ("Generate a new
one"). It takes 10–20 minutes. Builds run on Expo's Macs; the free plan has
a monthly allowance and a queue.

## 4. TestFlight on your iPhone

```sh
npx eas-cli submit -p ios --latest
```

This creates the app in App Store Connect if needed and uploads the build.
After Apple's processing (about 10–30 minutes) open App Store Connect →
your app → **TestFlight**, add yourself as a tester, and install it with the
TestFlight app. Check: play a mission, open **Pilot**, try Sign in with
Apple, win a mission and open the leaderboard.

Quicker loop while changing the game (no build needed): `npm start` in
`mobile/` and open it in the **Expo Go** app on the iPhone. Everything works
there except Sign in with Apple, whose tokens are issued to Expo Go rather
than your app.

Next builds: bump nothing by hand (`autoIncrement` raises the build number),
just run the build and submit commands again.

## 5. App Store listing (App Store Connect, in the browser)

- **Category:** Games → Simulation (secondary: Puzzle). **Age rating:** 4+.
- **Screenshots:** landscape, iPhone 6.9" or 6.5" display and iPad 13".
  Screenshots taken on your own iPhone from the TestFlight build are fine
  for the iPhone size; for iPad, borrow one or ask (the app supports iPad).
- **Privacy policy URL:** `https://thrusterz.com/privacy.html`.
- **Support URL:** `https://thrusterz.com/support.html`.
- **App Privacy:** data collected = *User ID*, *Gameplay Content*, *Other
  User Content* (the pilot name), all linked to the user; and *Crash Data*,
  not linked. All for App Functionality, none used for tracking. (Matches
  the privacy manifest.)
- **Review notes:** "No login required; an anonymous account is created
  automatically. Sign in with Apple is optional (Pilot screen). Account
  deletion: Pilot → Delete account. Pilot names are filtered for offensive
  words, any name on a leaderboard can be reported by tapping it (it's hidden
  for the reporter at once, and reset after several reports), and players can
  reach us at the support URL. The whole game is bundled and plays offline;
  it uses Sign in with Apple, haptics and native storage."
- Export compliance is already answered in the app (`ITSAppUsesNonExemptEncryption = NO`).

Then **Add for Review → Submit**.

## Android later

The same `mobile/` project builds for Android: `npx eas-cli build -p
android` and `eas submit -p android` (Google Play account needed). Sign in
with Apple is iOS-only; the restore code works everywhere.
