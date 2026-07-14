/**
 * Cloudflare Worker Template for بنّاء AI v7
 * Routes:
 *   POST /ai          -> proxy to Anthropic Claude API
 *   POST /pay/init    -> placeholder for ZainCash order creation
 *   GET  /pay/status  -> placeholder paid status
 *
 * Required env vars in Cloudflare:
 *   ANTHROPIC_API_KEY = sk-ant-...
 * Optional:
 *   ALLOWED_ORIGIN = https://your-domain.pages.dev
 */
const cors = (env) => ({
  'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json; charset=utf-8'
});
const json = (obj, env, status = 200) => new Response(JSON.stringify(obj), { status, headers: cors(env) });

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(env) });
    const url = new URL(request.url);

    if (url.pathname === '/ai' && request.method === 'POST') {
      if (!env.ANTHROPIC_API_KEY) return json({ error: 'Missing ANTHROPIC_API_KEY' }, env, 500);
      const body = await request.json();
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: body.model || 'claude-sonnet-4-5',
          max_tokens: body.max_tokens || 4500,
          messages: body.messages || []
        })
      });
      const data = await r.json();
      return json(data, env, r.ok ? 200 : 500);
    }

    if (url.pathname === '/pay/init' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const orderId = crypto.randomUUID();
      // TODO: replace with real ZainCash API request.
      // Store orderId + deviceId + amount in D1/KV, then return the real payment URL.
      return json({
        orderId,
        payUrl: `${url.origin}/pay/status?order=${encodeURIComponent(orderId)}&demo=1`,
        note: 'Demo payment URL. Replace with real ZainCash integration.'
      }, env);
    }

    if (url.pathname === '/pay/status' && request.method === 'GET') {
      // TODO: check order status from ZainCash or your database.
      return json({ paid: url.searchParams.get('demo') === '1', order: url.searchParams.get('order') }, env);
    }

    return json({ ok: true, service: 'bannaa-ai-worker', routes: ['/ai', '/pay/init', '/pay/status'] }, env);
  }
};
