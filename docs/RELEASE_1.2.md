# Releasing 1.2: the Shop, Game Center and ratings

A step-by-step runbook for getting everything merged to `main` live on the
App Store: the **Shop** (27 in-app purchases), **Game Center** (6
leaderboards, 15 achievements) and the **rating prompt**. Do the parts in
order. Each part says what it needs before it starts.

The short answer on the EAS build: **build after Parts 1–4.** The build
doesn't contain your product list or Game Center setup (those live in App
Store Connect), so it would *build* fine at any time. But you can't test a
purchase or a leaderboard until they exist in App Store Connect and the Paid
Apps agreement is active. Building last means you test once instead of
building twice.

| Part | Where | Waits on | Time |
| --- | --- | --- | --- |
| 1. Paid Apps agreement | App Store Connect → Business | nothing: **start it today** | 15 min, then Apple can take a day or more |
| 2. Check the server | Vercel / a browser | nothing | 2 min |
| 3. Create the 27 in-app purchases | App Store Connect → your app | nothing (Part 1 can still be pending) | 1–2 hours |
| 4. Set up Game Center | App Store Connect → your app | nothing | 45 min |
| 5. Version number, EAS build, TestFlight | your computer | the code on `main` | 30–45 min, mostly waiting |
| 6. Test on your iPhone | TestFlight | Parts 1, 3, 4, 5 (Part 1 **Active**) | 30 min |
| 7. Fill in version 1.2.0 and submit | App Store Connect | Part 6 passing | 30 min |
| 8. Review, release, check it's live | App Store Connect | Apple's review (usually 1–2 days) | 10 min |

Images you'll upload are made by `node tools/store/badges.js`, which writes
`store/achievements/` (15 badges) and `store/iap-review/` (Shop
screenshots). `store/` isn't committed, so run it once on your computer
(it needs the repo's `npm install` and Playwright's Chromium:
`npx playwright install chromium`).

---

## Part 1. Paid Apps agreement, banking and tax (start first)

Without an **Active** Paid Apps agreement, the App Store returns *no
products* to the app, even in TestFlight. The Shop then shows its fallback
prices and every Buy fails. This is the step most likely to keep you
waiting, so start it before anything else.

1. Go to https://appstoreconnect.apple.com and sign in as the **Account
   Holder** (only that role can accept agreements).
2. Open **Business** (older layouts call it **Agreements, Tax, and
   Banking**).
3. Under **Paid Apps**, click **View and Agree to Terms**, then accept.
4. Still on that row, complete each item it lists:
   - **Bank Account:** add the account Apple should pay into.
   - **Tax Forms:** fill in the US form (W-9 for a US person or company;
     otherwise W-8BEN or W-8BEN-E), plus any your country needs.
   - **Contacts:** fill in the required roles (you can be every one).
5. The status shows **Processing** and then **Active**. Part 6 can't start
   until it is **Active**. Parts 2–5 can go ahead meanwhile.

## Part 2. Check the server is ready

The purchase check (`/api/purchase`) shipped with the merge to `main`, and
Vercel deploys `main` on its own. No new environment variables are needed:
the bundle id it checks defaults to `com.thrusterz.app` (set
`APPLE_BUNDLE_ID` on Vercel only if you ever change the bundle id).

1. In Vercel → the Thrusterz project → **Deployments**, check the top
   *Production* deployment is the latest `main` commit and says **Ready**.
2. Check the purchase route exists. In a terminal:
   ```sh
   curl -s -X POST https://thrusterz.com/api/purchase
   ```
   You should get `{"error":"Sign in required"}`. That means the route is
   live and refusing anonymous calls. A 404 means the deployment is old:
   redeploy `main`.

## Part 3. Create the 27 in-app purchases

All 27 are **Non-Consumable** (bought once, kept forever). The **Product
IDs must be exactly as below**: the game looks them up by these strings
(`js/skins.js`, `PRODUCTS`), and a product ID can never be reused or
renamed once created.

### 3a. Create each product

For each row in the table below:

1. App Store Connect → **Apps** → **Thrusterz** → in the sidebar under
   **Monetization**, **In-App Purchases** → the **+** button.
2. **Type:** Non-Consumable.
3. **Reference Name:** the *Display Name* from the table. Only you see this.
4. **Product ID:** the *Product ID* from the table, copied exactly.
5. Click **Create**. On the product's page:
   - **Availability:** **All Countries or Regions**.
   - **Price Schedule** → **Add Pricing** → base country **United States**,
     price from the table → Next → keep Apple's automatic prices for other
     countries → Confirm.
   - **App Store Localization** → **Add Localization** → **English (U.S.)**:
     **Display Name** and **Description** from the table (the descriptions
     fit Apple's 55-character limit). These show on the purchase sheet.
   - **Review Information** → **Screenshot:** upload
     `store/iap-review/shop-2796x1290.png`. For the gold items use
     `shop-gold-2796x1290.png`, and for world items
     `shop-worlds-2796x1290.png`. **Review Notes:** "Menu → Shop. Cosmetic
     only (or: opens a world early that also opens free with stars)."
   - **Family Sharing:** leave **off**. Once turned on it can never be
     turned off; you can decide later.
   - **Tax Category:** leave the default.
6. **Save.** The status should become **Ready to Submit**. If it says
   **Missing Metadata**, a section above is still empty.

You'll attach them all to the new version in Part 7. **The first in-app
purchases must be submitted together with an app version**, and they can't
be reviewed on their own.

### 3b. The products

| # | Product ID | Display Name | Price (US) | Description (≤ 55 chars) |
| --- | --- | --- | --- | --- |
| 1 | `com.thrusterz.app.hull.cadet` | Cadet hull | $0.99 | Flight-school white with orange bands and fins. |
| 2 | `com.thrusterz.app.hull.retro` | Retro Red hull | $0.99 | Red and cream, straight off a 1950s pulp cover. |
| 3 | `com.thrusterz.app.hull.stealth` | Stealth hull | $0.99 | Matte black with a red visor and pinstripe. |
| 4 | `com.thrusterz.app.hull.tiger` | Tiger hull | $0.99 | Burnt orange with black tiger stripes. |
| 5 | `com.thrusterz.app.hull.shuttle` | Space Shuttle hull | $1.99 | The orbiter, tank and boosters. Stages for real. |
| 6 | `com.thrusterz.app.flame.blue` | Cold Blue flame | $0.99 | A clean blue burn, like a methane engine. |
| 7 | `com.thrusterz.app.flame.sunset` | Sunset flame | $0.99 | Peach at the nozzle, fading through pink to violet. |
| 8 | `com.thrusterz.app.flame.ghost` | Ghost flame | $0.99 | Pale and see-through, as if it's barely there. |
| 9 | `com.thrusterz.app.trail.neon` | Neon trail | $0.99 | A hot pink line with a neon glow. |
| 10 | `com.thrusterz.app.rcs.rings` | Halo Rings thrusters | $0.99 | Little cyan rings that spread out as they fade. |
| 11 | `com.thrusterz.app.rcs.neondust` | Neon Dust thrusters | $0.99 | Pink sparks to match the Neon trail. |
| 12 | `com.thrusterz.app.sat.silver` | Silver Foil satellite | $0.99 | Silver insulation and dark, high-efficiency panels. |
| 13 | `com.thrusterz.app.sat.hubble` | Hubble satellite | $0.99 | The space telescope, aperture door open. |
| 14 | `com.thrusterz.app.sat.iss` | ISS satellite | $1.99 | The space station: truss, modules, golden wings. |
| 15 | `com.thrusterz.app.sat.jwst` | James Webb satellite | $1.99 | A gold honeycomb mirror on a giant sunshield. |
| 16 | `com.thrusterz.app.sat.voyager` | Voyager satellite | $0.99 | A big white dish and long booms. Still going. |
| 17 | `com.thrusterz.app.pack.hangar` | Hangar Pack | $14.99 | Every skin in the Shop except gold. |
| 18 | `com.thrusterz.app.gold.hull` | Solid Gold hull | $4.99 | Polished gold. Flies the same; looks expensive. |
| 19 | `com.thrusterz.app.gold.flame` | Gold Rush flame | $2.99 | A molten-gold plume with a white-hot core. |
| 20 | `com.thrusterz.app.gold.trail` | Gold Leaf trail | $2.99 | A glowing gold line behind you. |
| 21 | `com.thrusterz.app.gold.rcs` | Gold Dust thrusters | $2.99 | Every turn scatters gold dust. |
| 22 | `com.thrusterz.app.gold.sat` | Gold Standard satellite | $2.99 | Gold body, gold panels, gold everything. |
| 23 | `com.thrusterz.app.pack.gold` | Gold Set | $11.99 | All five gold skins. Not in the Hangar Pack. |
| 24 | `com.thrusterz.app.world.2` | Open World 2 now | $1.99 | Play every World 2 mission without the stars. |
| 25 | `com.thrusterz.app.world.3` | Open World 3 now | $1.99 | Play every World 3 mission without the stars. |
| 26 | `com.thrusterz.app.world.4` | Open World 4 now | $1.99 | Play every World 4 mission without the stars. |
| 27 | `com.thrusterz.app.world.all` | Open every world | $3.99 | Worlds 2, 3, 4 and every world still to come. |

If you change a price here, also change the `price` in `js/skins.js`
(`PRODUCTS`). That's only the label shown when the App Store can't be
reached; normally the Shop shows Apple's localized price.

## Part 4. Set up Game Center

The app already asks for Game Center (the entitlement is in
`mobile/app.json`, and EAS turns the capability on for the App ID during
the build). What's missing is the leaderboards and achievements in App
Store Connect. **IDs must match exactly**: the game posts to them by these
strings (`js/game.js`, "Game Center, App Store").

1. App Store Connect → **Apps** → **Thrusterz** → **Game Center** (in the
   sidebar under **Features**, or in the **Services** tab in newer
   layouts).

### 4a. Leaderboards (6)

For each row: **Leaderboards → +** → **Classic Leaderboard**, then:

- **Reference Name:** the Name below. **Leaderboard ID:** the ID below.
- **Score Format Type:** Integer.
- **Score Submission Type:** **Best Score** (keep the highest).
- **Sort Order:** **High to Low**.
- **Score Range:** leave empty.
- **Localization → Add → English (U.S.):** **Name** as below, **Score
  Format:** Integer, **Score Format Suffix** as below (with the leading
  space), image optional (skip it).

| Leaderboard ID | Name | Suffix |
| --- | --- | --- |
| `thrusterz.total_stars` | Total Stars | ` stars` |
| `thrusterz.total_score` | Total Score | ` points` |
| `thrusterz.world1_score` | Flight School | ` points` |
| `thrusterz.world2_score` | Payloads | ` points` |
| `thrusterz.world3_score` | No-Fly Zones | ` points` |
| `thrusterz.world4_score` | Pulsar | ` points` |

### 4b. Achievements (15)

For each row: **Achievements → +**, then:

- **Reference Name:** the Title below. **Achievement ID:** the ID below.
- **Point Value:** as below (they total 390 of Apple's 1000, leaving room
  for future worlds).
- **Hidden:** No. **Achievable More Than Once:** No.
- **Localization → Add → English (U.S.):**
  - **Title:** as below.
  - **Pre-earned Description:** the Description below.
  - **Earned Description:** the Description in the past tense (for example
    "Completed your first mission").
  - **Image:** the file with the same name as the ID, from
    `store/achievements/` (1024×1024 PNG; for example
    `store/achievements/thrusterz.first_mission.png`). **Required:** Apple
    won't save an achievement without one.

| Achievement ID | Title | Description | Points |
| --- | --- | --- | --- |
| `thrusterz.first_mission` | Liftoff | Complete your first mission | 5 |
| `thrusterz.first_three_stars` | Textbook | Earn three stars on a mission | 5 |
| `thrusterz.training_complete` | Cadet | Complete every Training mission | 10 |
| `thrusterz.training_perfect` | Top Cadet | Three stars on every Training mission | 10 |
| `thrusterz.world1_complete` | Flight School Graduate | Complete every mission in World 1 | 25 |
| `thrusterz.world1_perfect` | Flight School Ace | Three stars on every mission in World 1 | 50 |
| `thrusterz.world2_complete` | Payload Specialist | Complete every mission in World 2 | 25 |
| `thrusterz.world2_perfect` | Payload Ace | Three stars on every mission in World 2 | 50 |
| `thrusterz.world3_complete` | Zone Runner | Complete every mission in World 3 | 25 |
| `thrusterz.world3_perfect` | No-Fly Ace | Three stars on every mission in World 3 | 50 |
| `thrusterz.world4_complete` | Pulsar Pilot | Complete every mission in World 4 | 25 |
| `thrusterz.world4_perfect` | Pulsar Ace | Three stars on every mission in World 4 | 50 |
| `thrusterz.stars_50` | Fifty Stars | Hold 50 stars | 10 |
| `thrusterz.stars_150` | Star Collector | Hold 150 stars | 20 |
| `thrusterz.stars_300` | Constellation | Hold 300 stars | 30 |

Like the purchases, these go live with the version you submit in Part 7.

## Part 5. Version number, EAS build, TestFlight

Needs: the code on `main`. Do it after Parts 1–4 have at least been
started (see the top for why).

1. **Version number.** The App Store already has 1.1.0, and a new release
   needs a higher number. `mobile/app.json` → `expo.version` is **1.2.0**
   (set in the same change as this document). If App Store Connect shows
   1.1.0 was never released and is still pending, you can still use 1.2.0;
   skipping a number is fine. You don't touch the build number:
   `eas.json` has `autoIncrement` and EAS keeps count.
2. **Get the latest code** on your computer:
   ```sh
   git checkout main
   git pull
   cd mobile
   npm install
   ```
3. **Build** (on Expo's Macs, about 15–25 minutes):
   ```sh
   npx eas-cli build -p ios --profile production
   ```
   - If it says the provisioning profile doesn't include **Game Center**
     and offers to update or regenerate it, say **Yes**.
   - This build has to be new. The purchase code (`expo-iap`) and Game
     Center are native code, so an old build, Expo Go or an over-the-air
     update can't add them.
4. **Upload to App Store Connect:**
   ```sh
   npx eas-cli submit -p ios --latest
   ```
   After Apple processes it (10–30 minutes), it shows in App Store Connect
   → **TestFlight** as build 1.2.0 (n). If asked about export compliance,
   it's already answered in the app (no encryption).
5. In **TestFlight → Internal Testing**, add yourself to a group (once), and
   the new build is offered to you in the **TestFlight** app on your
   iPhone.

## Part 6. Test on your iPhone (TestFlight)

Needs: Part 1 **Active**, Parts 3–5 done.

In TestFlight, purchases use Apple's **sandbox**: you sign in with your
normal Apple ID and **aren't charged**. Game Center also uses its test
environment, so scores here don't show on the public leaderboards.

Install the build from TestFlight, then check each item:

**Shop**
- [ ] Menu → **Shop**: every item shows a price in your currency (not just
      "$0.99"). Fallback prices everywhere mean the Paid Apps agreement
      isn't Active yet, or the product IDs don't match.
- [ ] Buy a $0.99 skin → the Apple purchase sheet appears → confirm → the
      tile says **✓ Owned** and the skin is in the **Hangar**.
- [ ] Start a purchase and **Cancel** → nothing changes, no error message.
- [ ] Buy **Open World 3 now** (if it's still locked for you) → its tab
      opens at once.
- [ ] Equip the bought skin, finish a mission, open its leaderboard → your
      rocket shows beside your name.
- [ ] Buy another skin and, the moment Apple's sheet says **Done**, turn
      on **Airplane Mode**. The skin is owned at once anyway. Turn
      Airplane Mode off and reopen the app: still owned (the game handed
      the purchase to the server when it got back online).
- [ ] Delete the app, reinstall it from TestFlight, restore your pilot (the
      landing page's "Played before?" or Pilot → restore code), then Shop
      → **Restore purchases** → everything you bought comes back.

**Game Center**
- [ ] At launch a "Welcome back" Game Center banner slides in (or a sign-in
      prompt if you're not signed in to Game Center).
- [ ] A **Game Center** button appears on the menu and opens the dashboard
      with the 6 leaderboards and 15 achievements.
- [ ] Win a mission → your totals appear on **Total Stars** / **Total
      Score**, and **Liftoff** (and maybe more) unlocks.

**Rating prompt.** iOS never shows it in TestFlight, so there's nothing to
test. Settings → **Rate Thrusterz** opens the App Store page.

If something fails, note what you saw and send it back. Nothing in Part 7
should start until this list passes.

To test a purchase again from scratch: delete the app and use a **Sandbox
Apple Account** (App Store Connect → **Users and Access** → **Sandbox** →
**+**, using an email address that isn't already an Apple ID). On the
iPhone, sign it in under **Settings → App Store → Sandbox Account**.

## Part 7. Fill in version 1.2.0 and submit

Needs: Part 6 passing.

1. App Store Connect → **Thrusterz** → the **+** next to *iOS App* → enter
   **1.2.0**. (If a 1.1.0 version is still pending and was never released,
   open it and change its number to 1.2.0 instead.)
2. **What's New in This Version** (paste and edit as you like):
   > Customise your rocket. Earn new hulls, flames, trails, thrusters and
   > satellites by clearing worlds and collecting stars, see them in the
   > new Hangar, and show them off beside your name on the leaderboards.
   > Real spacecraft: the Saturn V and the Space Shuttle drop their stages
   > as you fly. A new Shop sells extra looks and opens worlds early, and
   > every mission stays free. Game Center leaderboards and achievements
   > are here too.
3. **Build:** click **Add Build** and pick the 1.2.0 build from Part 5.
4. **In-App Purchases and Subscriptions:** click **+** / **Select** and tick
   **all 27** products. They must be *Ready to Submit*. If one is missing
   from the list, its metadata isn't finished (Part 3).
5. **Game Center:** turn it **on** for this version, then add **all 6
   leaderboards** and **all 15 achievements**.
6. **App Privacy** (the app's sidebar, not the version page) → **Edit** →
   add **Purchases → Purchase History**: *linked to the user*, *not used for
   tracking*, purpose **App Functionality** → **Publish**. Leave the rest
   as it is (User ID, Gameplay Content, Other User Content, Crash Data).
   This matches `mobile/app.json` and `privacy.html`.
7. **App Review Information → Notes:** paste the review notes from
   `docs/APP_STORE.md` §5, which already describe the Shop and Restore
   purchases. Add:
   > Game Center: the app signs in at launch, and the menu has a Game
   > Center button. Leaderboards and achievements are updated from the
   > stars held. To see the Shop: menu → Shop. All items are
   > non-consumable; Restore purchases is at the bottom of the Shop.
8. **Screenshots:** the current ones are fine. Optionally add one of the
   Hangar or Shop.
9. **Version Release:** choose **Manually release this version** if you
   want to press the button yourself after approval (recommended for the
   first IAP release), or **Automatically**.
10. Click **Add for Review** → **Submit to App Review**. The version, the
    27 purchases and the Game Center items go to review together.

## Part 8. Review, release, and check it's live

1. Review usually takes 1–2 days. If Apple rejects something, the message
   is in **App Review** in App Store Connect; reply there or fix it and
   resubmit. Common ones for a first Shop:
   - "We couldn't find the in-app purchases": point them to menu → Shop in
     your reply.
   - A product left out of the version: tick it (Part 7.4) and resubmit.
2. When approved (and if you chose manual release): **Release This
   Version**.
3. Once it's on the App Store (it can take a few hours to reach every
   country), update on your iPhone and check:
   - [ ] Shop prices load (in your currency).
   - [ ] Optionally buy one $0.99 skin for real, then Shop → Restore
         purchases on a second device.
   - [ ] The Game Center leaderboards fill in as players arrive.

## Not covered yet

- **Refunds:** if Apple refunds a purchase, the item stays on the pilot
  account; Restore won't bring it back, but nothing takes it away either.
  Fixing this needs App Store Server Notifications (see `docs/SHOP.md`).
- **Web purchases:** the website Shop says purchases are in the iOS app.
- **Android:** needs Google Play products and its own purchase checks.
- **Adding a product later:** add it to `PRODUCTS` in `js/skins.js`, create
  it here exactly as in Part 3, ship a build, and attach it to that
  version.
- **A new world:** add its two achievements (`thrusterz.worldN_complete`,
  `thrusterz.worldN_perfect`) and leaderboard (`thrusterz.worldN_score`) in
  Part 4's style. The game reports them automatically.
