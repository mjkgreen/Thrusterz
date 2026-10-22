# Skins and the Shop

How Thrusterz makes money: a free game, with rocket skins to earn and to buy,
and the option to open a world early. No ads yet, no loot boxes, nothing that
changes how a rocket flies, and every mission can be reached for free.

## What's built

### Skins (`js/skins.js`)

A rocket's look has five slots. Each item is earned, bought, or standard issue.

| Slot | Earned | Shop | Gold |
| --- | --- | --- | --- |
| Hull | Clear every mission in a world: Checkerboard (1), Nebula (2), Hazard (3), Chrome Needle (4); 250 ★ Apollo | Cadet, Retro Red, Stealth, Tiger | Solid Gold |
| Flame | Three stars on every mission in a world: Strontium Red (1), Plasma (2), Boron Green (3), Pulsar (4) | Cold Blue, Sunset, Ghost | Gold Rush |
| Trail | 100 ★ Comet, 300 ★ Aurora | Neon | Gold Leaf |
| Thrusters (RCS puffs) | 200 ★ Ember Sparks | Halo Rings, Neon Dust | Gold Dust |
| Satellite (the craft you fly after delivering one) | 150 ★ Sputnik | Silver Foil, Hubble, ISS, James Webb, Voyager | Gold Standard |

Earned skins are never sold, so they stay a sign of skill. Training earns
no skins; rewards start with the real worlds. Shop skins are
extras, never better versions of earned ones. Gold skins are the same
rockets in gold, priced higher purely for showing off, and are never in the
Hangar Pack. The Hangar lists each slot as standard issue, then earned, then
Shop, then gold. A rocket carrying a payload wears a fairing in its hull's
accent colour (gold on the Classic hull).

What players see:

- **Hangar** (menu): every skin, how to earn it and progress towards it. Tap to
  equip, or tap a locked one to preview it.
- **World tabs**: each world's two rewards and how close you are.
- **Result screen**: announces a new skin.
- **Leaderboards**: hull and flame beside each name. The server only shows
  skins it has granted (from verified runs or verified purchases).

### Shop (menu → Shop, or "Open it now" on a locked world)

Non-consumable App Store purchases, ids in `Skins.PRODUCTS`:

| Product id | What | Price |
| --- | --- | --- |
| `com.thrusterz.app.hull.cadet` | Cadet hull | $0.99 |
| `com.thrusterz.app.hull.retro` | Retro Red hull | $0.99 |
| `com.thrusterz.app.hull.stealth` | Stealth hull | $0.99 |
| `com.thrusterz.app.hull.tiger` | Tiger hull | $0.99 |
| `com.thrusterz.app.flame.blue` | Cold Blue flame | $0.99 |
| `com.thrusterz.app.flame.sunset` | Sunset flame | $0.99 |
| `com.thrusterz.app.flame.ghost` | Ghost flame | $0.99 |
| `com.thrusterz.app.trail.neon` | Neon trail | $0.99 |
| `com.thrusterz.app.rcs.rings` | Halo Rings thrusters | $0.99 |
| `com.thrusterz.app.rcs.neondust` | Neon Dust thrusters | $0.99 |
| `com.thrusterz.app.sat.silver` | Silver Foil satellite | $0.99 |
| `com.thrusterz.app.sat.hubble` | Hubble satellite | $0.99 |
| `com.thrusterz.app.sat.iss` | ISS satellite | $1.99 |
| `com.thrusterz.app.sat.jwst` | James Webb satellite | $1.99 |
| `com.thrusterz.app.sat.voyager` | Voyager satellite | $0.99 |
| `com.thrusterz.app.pack.hangar` | Hangar Pack: every Shop skin except gold | $14.99 |
| `com.thrusterz.app.gold.hull` | Solid Gold hull | $4.99 |
| `com.thrusterz.app.gold.flame` | Gold Rush flame | $2.99 |
| `com.thrusterz.app.gold.trail` | Gold Leaf trail | $2.99 |
| `com.thrusterz.app.gold.rcs` | Gold Dust thrusters | $2.99 |
| `com.thrusterz.app.gold.sat` | Gold Standard satellite | $2.99 |
| `com.thrusterz.app.pack.gold` | Gold Set: all five gold skins (not in the Hangar Pack) | $11.99 |
| `com.thrusterz.app.world.2` / `.3` / `.4` | Open that world now | $1.99 |
| `com.thrusterz.app.world.all` | Open every world, future ones too | $3.99 |

The Shop shows the App Store's localized price when it can reach the store,
and the price above otherwise. A world bought early still shows its stars
progress, and buying never takes stars or missions away from anyone.

### How a purchase flows

1. **Game → app shell** (`js/online.js` → `mobile/App.js`, through
   `expo-iap`/StoreKit 2): `iapBuy` returns the signed transaction (JWS).
2. **On the device**, the purchase counts at once. It is kept in
   `thrusterz.iap.v1`, which is also saved natively, so a purchase made
   offline is never lost.
3. **Server** (`POST /api/purchase`, `api/_lib/apple-iap.js`) checks the
   transaction:
   - the certificate chain ends at Apple Root CA - G3 (pinned fingerprint) and
     carries Apple's App Store OIDs;
   - the ES256 signature is valid;
   - the bundle id matches and the product is one we sell;
   - it has not been refunded.

   If it passes, the product goes on the pilot account (`owns`, plus its
   skins). Sandbox transactions (TestFlight, App Review) are accepted.
4. **App shell** finishes the transaction once the server has it. Unfinished
   ones replay at launch and are claimed again.
5. **Restore purchases** (in the Shop) re-sends every transaction the App Store
   still holds for this Apple ID.

On a new device, purchases come back with the pilot account (restore code or
Sign in with Apple), or through Restore purchases.

**Local testing:** with `npm run dev`, open `/?shopdev` and buy for free. The
server only allows this on its in-memory store, never on a real deployment.

## To launch it

1. **App Store Connect:**
   - Agreements → accept the **Paid Apps** agreement and fill in banking and
     tax. In-app purchases don't work until this is done.
   - Your app → In-App Purchases → create each product in the table as
     **Non-Consumable**, with the exact id, a display name, a price, a
     description and a review screenshot (a Shop screenshot works).
   - Add the products to the next version for review.
2. **Server env (Vercel):** `APPLE_BUNDLE_ID` defaults to `com.thrusterz.app`;
   set it only if the bundle id changes.
3. **Build:** `expo-iap` is a native module. Make a new EAS build
   (`eas build -p ios`); the Expo Go/dev client from before won't have it.
4. **Test on TestFlight with a Sandbox account:** Settings → App Store →
   Sandbox Account. Try buy, cancel, Restore purchases, a purchase made with
   flight mode on, and reinstall then Restore.
5. **App Store listing:** turn on "In-App Purchases" in the listing. Privacy
   answers, review notes and the privacy policy already mention the Shop
   (`docs/APP_STORE.md`, `privacy.html`).

## Not built yet (next steps)

- **Refunds:** subscribe to App Store Server Notifications v2 (`REFUND`,
  `REVOKE`) and take the product back off the account. Today a refunded
  purchase is refused at Restore, but one already claimed stays owned.
- **Web purchases:** the website shows the Shop with a note that purchases are
  in the iOS app. Stripe Checkout could sell the same products on the web,
  granted to the pilot account in the same way.
- **Android:** `expo-iap` covers Google Play too. It needs Play Console products
  and server-side Play purchase verification.
- **More Shop content:** more real spacecraft (Space Shuttle, Vostok, Mir,
  Cassini, a lunar lander), themed packs, seasonal skins. Each is one entry in `js/skins.js` and one product.
- **Ads (optional, later):** rewarded only (try a Shop skin for three
  missions, or open the next world a few stars early), plus a "Remove ads"
  product. Never during a flight or after a crash. Needs App Tracking
  Transparency and privacy label changes.
- **A tip jar:** small, medium and large supporter purchases, each with a
  thank-you badge.
