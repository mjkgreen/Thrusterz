// Thrusterz native shell: runs the web game (bundled as one HTML file, see
// tools/build-mobile.js) full screen in a WebView and gives it what a web
// page can't have on its own: storage the OS won't clear, Sign in with
// Apple, haptics and opening links in Safari. Messages from the game arrive
// through postMessage (js/bridge.js on the web side).
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});

// The only keys the game may store natively.
const KEYS = ['thrusterz.progress.v1', 'thrusterz.account.v1', 'thrusterz.runs.v1'];
// The page's origin inside the WebView (gives it its own localStorage).
const BASE = 'https://app.thrusterz.game/';
const BG = '#05060d';

export default function App() {
  const web = useRef(null);
  const [page, setPage] = useState(null);

  useEffect(() => {
    (async () => {
      const [asset] = await Asset.loadAsync(require('./assets/game/game.html'));
      const html = await new File(asset.localUri).text();
      // Hand the game its saved data before it starts, so it loads instantly.
      const store = {};
      for (const [k, v] of await AsyncStorage.multiGet(KEYS)) if (v != null) store[k] = v;
      const appleSignIn = Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync().catch(() => false));
      const boot = `window.__THRUSTERZ_NATIVE = ${JSON.stringify({ platform: Platform.OS, store, appleSignIn })}; true;`;
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
