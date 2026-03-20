/**
 * Steadfast Courier API Proxy — Cloudflare Worker
 * 
 * This worker securely proxies requests to the Steadfast API, keeping your
 * Secret Keys hidden from the frontend on GitHub Pages.
 * 
 * Environment Variables required in Cloudflare Dashboard:
 * - STEADFAST_API_KEY
 * - STEADFAST_SECRET_KEY
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // You can restrict this to 'https://yourwebsite.com' in production
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight (OPTIONS request)
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    
    // Steadfast Base Configuration
    const STEADFAST_BASE = 'https://portal.packzy.com/api/v1';
    const sfHeaders = {
      'Api-Key': env.STEADFAST_API_KEY,
      'Secret-Key': env.STEADFAST_SECRET_KEY,
      'Content-Type': 'application/json',
    };

    try {
      // ── Create Order Endpoint ──
      if (path === '/api/steadfast/create-order' && request.method === 'POST') {
        const body = await request.clone().text();
        
        const sfResponse = await fetch(`${STEADFAST_BASE}/create_order`, {
          method: 'POST',
          headers: sfHeaders,
          body: body
        });
        
        const sfData = await sfResponse.json();
        return new Response(JSON.stringify(sfData), {
          status: sfResponse.status,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      // ── Track by Invoice ID Endpoint ──
      if (path.startsWith('/api/steadfast/track/') && request.method === 'GET') {
        const invoiceId = path.replace('/api/steadfast/track/', '').replace(/\/$/, "");
        
        const sfResponse = await fetch(`${STEADFAST_BASE}/status_by_invoice/${encodeURIComponent(invoiceId)}`, {
          method: 'GET',
          headers: sfHeaders
        });
        
        const sfData = await sfResponse.json();
        return new Response(JSON.stringify(sfData), {
          status: sfResponse.status,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      // ── Track by Tracking Code Endpoint ──
      if (path.startsWith('/api/steadfast/track-by-code/') && request.method === 'GET') {
        const code = path.replace('/api/steadfast/track-by-code/', '').replace(/\/$/, "");
        
        const sfResponse = await fetch(`${STEADFAST_BASE}/status_by_trackingcode/${encodeURIComponent(code)}`, {
          method: 'GET',
          headers: sfHeaders
        });
        
        const sfData = await sfResponse.json();
        return new Response(JSON.stringify(sfData), {
          status: sfResponse.status,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      // ── Get Balance Endpoint ──
      if (path === '/api/steadfast/balance' && request.method === 'GET') {
        const sfResponse = await fetch(`${STEADFAST_BASE}/get_balance`, {
          method: 'GET',
          headers: sfHeaders
        });
        
        const sfData = await sfResponse.json();
        return new Response(JSON.stringify(sfData), {
          status: sfResponse.status,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      // ── Unknown Endpoint ──
      return new Response(JSON.stringify({ error: 'Endpoint not found on proxy' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
  },
};
