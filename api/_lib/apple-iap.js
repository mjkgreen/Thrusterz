// Verifying App Store purchases. StoreKit 2 hands the app each transaction as
// a JWS signed by Apple; the app passes it on and the server checks it here
// before granting anything:
//   - the certificate chain in the header (x5c) ends at Apple Root CA - G3,
//     pinned by its SHA-256 fingerprint, with each certificate signed by the
//     next and the leaf and intermediate carrying Apple's App Store OIDs;
//   - the JWS is signed (ES256) by the leaf certificate;
//   - the transaction is for this app, for a product we sell, and not revoked.
// Sandbox transactions (TestFlight, App Review) are accepted too: Apple asks
// servers to, because App Review buys with sandbox accounts.
'use strict';
const crypto = require('crypto');

// SHA-256 of Apple Root CA - G3's certificate (DER), from
// https://www.apple.com/certificateauthority/. APPLE_ROOT_SHA256 overrides
// it (the tests use their own root).
const APPLE_ROOT_G3 = '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179';
const OID_LEAF = '1.2.840.113635.100.6.11.1';   // App Store receipt signing
const OID_INTERMEDIATE = '1.2.840.113635.100.6.2.1'; // Apple Worldwide Developer Relations

// An OID as the DER bytes that appear inside a certificate.
function oidBytes(oid) {
  const parts = oid.split('.').map(Number), out = [40 * parts[0] + parts[1]];
  for (const n of parts.slice(2)) {
    const b = [n & 0x7f];
    for (let v = n >>> 7; v; v >>>= 7) b.unshift(0x80 | (v & 0x7f));
    out.push(...b);
  }
  return Buffer.from([0x06, out.length, ...out]);
}
const hasOid = (cert, oid) => cert.raw.includes(oidBytes(oid));

class IapError extends Error {}

function verifyChain(x5c, now) {
  if (!Array.isArray(x5c) || x5c.length !== 3) throw new IapError('Bad certificate chain');
  const [leaf, mid, root] = x5c.map(b => new crypto.X509Certificate(Buffer.from(b, 'base64')));
  const pinned = (process.env.APPLE_ROOT_SHA256 || APPLE_ROOT_G3).toLowerCase().replace(/[^0-9a-f]/g, '');
  if (crypto.createHash('sha256').update(root.raw).digest('hex') !== pinned) throw new IapError('Not signed by Apple');
  if (!mid.verify(root.publicKey) || !leaf.verify(mid.publicKey)) throw new IapError('Broken certificate chain');
  if (!hasOid(leaf, OID_LEAF) || !hasOid(mid, OID_INTERMEDIATE)) throw new IapError('Not an App Store certificate');
  for (const c of [leaf, mid, root]) {
    if (now < Date.parse(c.validFrom) || now > Date.parse(c.validTo)) throw new IapError('Certificate expired');
  }
  return leaf;
}

// Check one signed transaction; returns its payload.
// opts: { bundleId, products: { id: ... } }
function verifyTransaction(jws, opts) {
  const parts = String(jws || '').split('.');
  if (parts.length !== 3) throw new IapError('Not a signed transaction');
  let header, payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  } catch (e) { throw new IapError('Not a signed transaction'); }
  if (header.alg !== 'ES256') throw new IapError('Unexpected signature type');
  // Certificates are checked at the time Apple signed the transaction, so a
  // purchase restored years later still verifies.
  const leaf = verifyChain(header.x5c, payload.signedDate || Date.now());
  const ok = crypto.verify('sha256', Buffer.from(parts[0] + '.' + parts[1]), { key: leaf.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(parts[2], 'base64url'));
  if (!ok) throw new IapError('Bad signature');
  if (payload.bundleId !== opts.bundleId) throw new IapError('Purchase is for another app');
  if (!Object.hasOwn(opts.products, payload.productId)) throw new IapError('Unknown product');
  if (payload.revocationDate) throw new IapError('Purchase was refunded');
  return payload;
}

module.exports = { verifyTransaction, IapError, APPLE_ROOT_G3 };
