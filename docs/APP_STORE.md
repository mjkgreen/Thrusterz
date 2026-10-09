# Shipping Thrusterz to the App Store

Everything in the repository is ready; the steps below are the parts only
you can do (accounts, keys, signing). Do them in order. Rough time: an hour
for 1–3, then App Review (usually 1–2 days).

What's built:

- **iOS app** (`ios/`, Capacitor 8, Swift Package Manager, no CocoaPods):
  landscape only, fullscreen, no status bar, app icon and launch screen,
  privacy manifest, Sign in with Apple entitlement, haptics.
- **Accounts and cloud save** (`api/`, Vercel Functions + Upstash Redis): a
  pilot account is created the first time it's needed; progress syncs and
  merges (only ever keeps the best); a **restore code** brings stars back on
  any device; **Sign in with Apple** does the same with no code to keep; the
  native copy of progress survives iOS clearing web storage; **Delete
  account** is in the Pilot screen (App Store rule 5.1.1(v)) and revokes the
  Apple token.
- **Leaderboards**: per mission, *Top score* and *Fastest*. Every flight is
  recorded as its control inputs; the server re-flies the run with the
  game's own code and ranks the result it computes itself, so scores can't
  simply be faked. The simulation uses its own deterministic math
  (`js/dmath.js`) so a run flown on an iPhone replays identically on the
  server. Boards reset automatically when a mission is retuned.

---

## 1. Server (Vercel)

1. In the Vercel project (the one that deploys this repo), open
   **Storage → Create → Upstash for Redis** (free tier is plenty) and
   connect it to the project. This adds the `KV_REST_API_URL` /
   `KV_REST_API_TOKEN` environment variables automatically. Plain Upstash
   with `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` works too.
   Without a database the API answers "not set up yet" and the game plays
   offline.
2. Add environment variables (Settings → Environment Variables):
   - `APPLE_CLIENT_ID` = your bundle ID (step 2), e.g. `com.thrusterz.game`
   - `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`: from the Sign in
     with Apple key (step 2.3). Paste the whole `.p8` file as the value.
3. Redeploy. Check `https://<your-domain>/api/board?level=liftoff` returns
   JSON, and that `https://<your-domain>/privacy.html` loads.
4. In `js/config.js` set `apiBase` to `https://<your-domain>` (the app
   needs the full address; the website uses its own `/api`).
5. Edit the contact email in `privacy.html`.

Local development: `npm run dev` serves the game and the API together on
http://localhost:8080 with an in-memory database.

## 2. Apple Developer account

1. **Bundle ID.** `com.thrusterz.game` is a placeholder. Pick your own
   reverse-domain ID and set it in three places: `capacitor.config.json`
   (`appId`), `js/config.js` (`appleClientId`) and in Xcode (step 3.3, which
   writes `PRODUCT_BUNDLE_IDENTIFIER`).
2. In Certificates, Identifiers & Profiles → Identifiers, register that
   App ID and tick **Sign in with Apple**.
3. Keys → **+** → enable **Sign in with Apple** for that App ID → download
   the `.p8` file (only downloadable once). Note the Key ID and your Team
   ID for step 1.2.

## 3. Build on your Mac

Needs Xcode 16 or newer and Node 20+.

```sh
git clone <repo> && cd Thrusterz
npm install          # Capacitor and plugins (the Xcode project links them from node_modules)
npm run ios          # copies the game into www/, syncs it into ios/, opens Xcode
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities** → choose your
   Team. Signing is automatic.
2. Check **Sign in with Apple** is listed under capabilities (the
   entitlement is already in `App/App.entitlements`; Xcode may ask to
   register it, click *Fix*).
3. **General** → set the Bundle Identifier (step 2.1), Version (1.0) and
   Build (1). Increase Build for every upload.
4. Plug in an iPhone, pick it as the run destination, press ▶. Play a
   mission, open **Pilot**, try Sign in with Apple, win a mission and open
   the leaderboard.
5. After any change to the web game: `npm run build:www && npx cap sync ios`,
   then run again from Xcode.

## 4. TestFlight

1. In App Store Connect → My Apps → **+ New App**: platform iOS, name
   Thrusterz, your bundle ID, a SKU (anything).
2. Xcode → Product → **Archive** → Distribute App → App Store Connect →
   Upload.
3. In App Store Connect → TestFlight, add yourself (and friends) as testers.
   Install through the TestFlight app and play for a few days.

## 5. App Store listing

- **Category:** Games → Simulation (secondary: Puzzle). **Age rating:**
  4+ (no objectionable content; the questionnaire answers are all "None").
- **Screenshots:** landscape, at least iPhone 6.9" (2868×1320 or
  2796×1290) and, since the app runs on iPad, iPad 13" (2752×2064). Good
  candidates: a World 2 mission mid-burn, the menu tabs, a leaderboard.
- **Privacy policy URL:** `https://<your-domain>/privacy.html`.
- **App Privacy** questionnaire (matches `ios/App/App/PrivacyInfo.xcprivacy`):
  data collected = *User ID*, *Gameplay Content*, *Other User Content*
  (the pilot name); all **linked to the user**, used for **App
  Functionality**, **not** used for tracking.
- **Sign-in information for review:** accounts are optional (the game
  creates one automatically), so tell the reviewer "No login required.
  Pilot screen → Sign in with Apple is optional."
- **Export compliance:** already answered in Info.plist
  (`ITSAppUsesNonExemptEncryption` = NO, the app only uses HTTPS).

Then **Submit for Review**.

## Later

- Android: `npm install @capacitor/android && npx cap add android`; the game
  and API already work there (Sign in with Apple would need the web flow or
  Google sign-in instead).
- Game Center achievements, ghost replays of the #1 run (best runs are
  already stored with their inputs), more worlds.
