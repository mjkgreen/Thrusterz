// Thrusterz native shell: runs the web game (bundled as one HTML file, see
// tools/build-mobile.js) full screen in a WebView and gives it what a web
// page can't have on its own: storage the OS won't clear, Sign in with
// Apple, App Store purchases, haptics and opening links in Safari. Messages from the game arrive
// through postMessage (js/bridge.js on the web side).
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import { setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';
import * as SplashScreen from 'expo-splash-screen';
import * as IAP from 'expo-iap';

SplashScreen.preventAutoHideAsync().catch(() => {});

// The only keys the game may store natively.
const KEYS = ['thrusterz.progress.v1', 'thrusterz.account.v1', 'thrusterz.runs.v1', 'thrusterz.iap.v1'];
// The page's origin inside the WebView (gives it its own localStorage).
const BASE = 'https://app.thrusterz.game/';
const BG = '#05060d';

// The game's Web Audio plays through this app's audio session, which by
// default is muted by the silent switch (and can stay inactive). Set it like
// a game: play even on silent unless the player turns that off in Settings,
// and mix with music from other apps.
let ignoreSilent = true;
const applyAudio = () => setAudioModeAsync({ playsInSilentMode: ignoreSilent, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false, allowsRecording: false })
  .then(() => setIsAudioActiveAsync(true)).catch(() => {});

// App Store purchases (iOS). StoreKit reports every completed transaction
// through one listener: the answer to a purchase the game asked for, or one
// replayed at launch because it was never finished. The game sends each to
// the server, which verifies Apple's signature, then asks us to finish it.
const iapOn = Platform.OS === 'ios';
const signed = (p) => ({ productId: p.productId, jws: p.purchaseToken, transactionId: p.id });

export default function App() {
  const web = useRef(null);
  const [page, setPage] = useState(null);
  const iap = useRef({ ready: null, buying: new Map(), held: new Map(), gameReady: false, queue: [] });

  useEffect(() => {
    if (!iapOn) return undefined;
    const st = iap.current;
    st.ready = IAP.initConnection().catch(() => false);
    const toGame = (t) => {
      if (st.gameReady) web.current?.injectJavaScript(`window.__iapUpdate && window.__iapUpdate(${JSON.stringify(t)}); true;`);
      else st.queue.push(t);
    };
    const ok = IAP.purchaseUpdatedListener((p) => {
      if (!p || !p.purchaseToken) return;
      st.held.set(p.id, p);
      const t = signed(p), id = st.buying.get(p.productId);
      if (id != null) { st.buying.delete(p.productId); reply(id, true, t); } else toGame(t);
    });
    const bad = IAP.purchaseErrorListener((e) => {
      const ids = e && e.productId ? [e.productId] : [...st.buying.keys()];
      for (const sku of ids) {
        const id = st.buying.get(sku);
        if (id == null) continue;
        st.buying.delete(sku);
        reply(id, false, e && e.code === 'user-cancelled' ? 'Purchase cancelled' : (e && e.message) || 'Purchase failed');
      }
    });
    return () => { ok.remove(); bad.remove(); IAP.endConnection().catch(() => {}); };
  }, []);

  useEffect(() => {
    applyAudio();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') applyAudio(); });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    (async () => {
      const [asset] = await Asset.loadAsync(require('./assets/game/game.html'));
      const html = await new File(asset.localUri).text();
      // Hand the game its saved data before it starts, so it loads instantly.
      const store = {};
      for (const [k, v] of await AsyncStorage.multiGet(KEYS)) if (v != null) store[k] = v;
      const appleSignIn = Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync().catch(() => false));
      const boot = `window.__THRUSTERZ_NATIVE = ${JSON.stringify({ platform: Platform.OS, store, appleSignIn, iap: iapOn })}; true;`;
      setPage({ html, boot });
    })().catch((e) => {
      setPage({ html: `<body style="background:${BG};color:#dfe6ff;font:16px system-ui;padding:40px">Thrusterz could not start: ${String(e && e.message)}</body>`, boot: 'true;' });
    });
  }, []);

  const reply = (id, ok, value) => {
    web.current?.injectJavaScript(`window.__nativeReply(${JSON.stringify(id)}, ${ok}, ${JSON.stringify(value ?? null)}); true;`);
  };

  const onMessage = async (event) => {
    let msg;
    try { msg = JSON.parse(event.nativeEvent.data); } catch (e) { return; }
    switch (msg.type) {
      case 'set':
        if (KEYS.includes(msg.key) && typeof msg.value === 'string') AsyncStorage.setItem(msg.key, msg.value).catch(() => {});
        break;
      case 'haptic':
        (msg.kind === 'success'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)).catch(() => {});
        break;
      case 'appleSignIn':
        try {
          const c = await AppleAuthentication.signInAsync({ requestedScopes: [] });
          reply(msg.id, true, { identityToken: c.identityToken, authorizationCode: c.authorizationCode });
        } catch (e) {
          reply(msg.id, false, e && e.code === 'ERR_REQUEST_CANCELED' ? 'Sign in was cancelled' : (e && e.message) || 'Sign in failed');
        }
        break;
      case 'audio':
        ignoreSilent = msg.ignoreSilent !== false;
        applyAudio();
        break;
      case 'iapReady': {
        // The game is listening: pass on transactions that arrived before it was.
        const st = iap.current;
        st.gameReady = true;
        for (const t of st.queue.splice(0)) web.current?.injectJavaScript(`window.__iapUpdate && window.__iapUpdate(${JSON.stringify(t)}); true;`);
        break;
      }
      case 'iapProducts':
        try {
          await iap.current.ready;
          const list = await IAP.fetchProducts({ skus: (msg.skus || []).map(String), type: 'in-app' });
          reply(msg.id, true, (list || []).map(p => ({ id: p.id, displayPrice: p.displayPrice })));
        } catch (e) { reply(msg.id, false, (e && e.message) || 'The App Store is unavailable'); }
        break;
      case 'iapBuy':
        try {
          await iap.current.ready;
          iap.current.buying.set(String(msg.sku), msg.id);
          // The outcome arrives through the listeners above.
          await IAP.requestPurchase({ request: { apple: { sku: String(msg.sku) } }, type: 'in-app' });
        } catch (e) {
          if (iap.current.buying.get(String(msg.sku)) === msg.id) { iap.current.buying.delete(String(msg.sku)); reply(msg.id, false, (e && e.message) || 'Purchase failed'); }
        }
        break;
      case 'iapRestore':
        try {
          await iap.current.ready;
          await IAP.restorePurchases().catch(() => {});
          const list = await IAP.getAvailablePurchases();
          const owned = (list || []).filter(p => p.purchaseToken);
          for (const p of owned) iap.current.held.set(p.id, p);
          reply(msg.id, true, owned.map(signed));
        } catch (e) { reply(msg.id, false, (e && e.message) || 'Restore failed'); }
        break;
      case 'iapFinish': {
        // The server has the purchase: tell StoreKit we're done with it.
        const p = iap.current.held.get(msg.transactionId);
        if (p) { iap.current.held.delete(msg.transactionId); IAP.finishTransaction({ purchase: p, isConsumable: false }).catch(() => {}); }
        break;
      }
      case 'open':
        if (typeof msg.url === 'string' && /^https:\/\//.test(msg.url)) Linking.openURL(msg.url).catch(() => {});
        break;
      default:
    }
  };

  // The game is one page: a tapped link (the privacy policy) opens in Safari
  // instead of replacing the game.
  const onShouldStartLoadWithRequest = (req) => {
    if (req.navigationType !== 'click') return true;
    if (/^https:\/\//.test(req.url) && !req.url.startsWith(BASE)) Linking.openURL(req.url).catch(() => {});
    return false;
  };

  return (
    <View style={styles.fill}>
      <StatusBar hidden />
      {page && (
        <WebView
          ref={web}
          style={styles.fill}
          source={{ html: page.html, baseUrl: BASE }}
          originWhitelist={['*']}
          // Game sound needs no extra tap, and plays inline.
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          injectedJavaScriptBeforeContentLoaded={page.boot}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onLoadEnd={() => SplashScreen.hideAsync().catch(() => {})}
          // iOS kills a WebView's process under memory pressure: reload.
          onContentProcessDidTerminate={() => web.current?.reload()}
          javaScriptEnabled
          domStorageEnabled
          bounces={false}
          scrollEnabled={false}
          overScrollMode="never"
          allowsLinkPreview={false}
          allowsBackForwardNavigationGestures={false}
          setSupportMultipleWindows={false}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          textInteractionEnabled={false}
          webviewDebuggingEnabled={__DEV__}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: BG } });
