export const config = { runtime: 'edge' };

const SURL = process.env.SUPABASE_URL;
const SKEY = process.env.SUPABASE_KEY;
const H = {
  'Content-Type': 'application/json',
  'apikey': SKEY,
  'Authorization': `Bearer ${SKEY}`,
  'Prefer': 'return=representation'
};

async function sb(method, path, body) {
  const r = await fetch(`${SURL}/rest/v1/${path}`, {
    method, headers: H,
    body: body ? JSON.stringify(body) : undefined
  });
  const t = await r.text();
  return { status: r.status, data: t ? JSON.parse(t) : null };
}

export default async function handler(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const method = req.method;

  try {
    if (method === 'GET') {
      const { data } = await sb('GET', 'watch_entries?select=*&order=watch_date.desc,id.desc');
      return json(data);
    }
    if (method === 'POST') {
      const body = await req.json();
      const { data } = await sb('POST', 'watch_entries', body);
      return json(data);
    }
    if (method === 'PATCH' && id) {
      const body = await req.json();
      const { data } = await sb('PATCH', `watch_entries?id=eq.${id}`, body);
      return json(data);
    }
    if (method === 'DELETE' && id) {
      await sb('DELETE', `watch_entries?id=eq.${id}`);
      return json({ ok: true });
    }
    return json({ error: 'Not found' }, 404);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
