// Deployment settings. Edit these for your own server and app.
window.THRUSTERZ_CONFIG = {
  // Where the API lives. The website calls its own /api; the iOS / Android
  // app (served from capacitor://localhost) needs the full address of the
  // Vercel deployment.
  apiBase: 'https://thrusterz.vercel.app',
  // The app's bundle ID, which is also the Sign in with Apple client ID
  // (must match APPLE_CLIENT_ID on the server and capacitor.config.json).
  appleClientId: 'com.thrusterz.game',
};
