import * as crypto from 'crypto';

export const config = { runtime: 'edge' };

function b32decode(s) {
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  s = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, val = 0;
  const out = [];
  for (const c of s) {
    const i = B32.indexOf(c);
    if (i < 0) continue;
    val = (val << 5) | i;
    bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}

async function getCode(secret, counter) {
  const key = await crypto.subtle.importKey(
    'raw', b32decode(secret),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const buf = new ArrayBuffer(8);
  new DataView(buf).setUint32(4, counter, false);
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
  const o = h[19] & 0xf;
  return String(((h[o] & 0x7f) << 24 | h[o+1] << 16 | h[o+2] << 8 | h[o+3]) % 1000000).padStart(6, '0');
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { code } = await req.json();
    if (!code || code.length !== 6) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid code' }), { status: 400 });
    }

    const secret = process.env.TOTP_SECRET;
    if (!secret) {
      return new Response(JSON.stringify({ ok: false, error: 'Server config error' }), { status: 500 });
    }

    const t = Math.floor(Date.now() / 30000);
    const codes = await Promise.all([getCode(secret, t-1), getCode(secret, t), getCode(secret, t+1)]);

    if (codes.includes(code)) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ ok: false, error: 'Wrong code' }), { status: 401 });
    }
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
}
