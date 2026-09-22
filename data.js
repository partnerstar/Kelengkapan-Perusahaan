// Cloudflare Pages Function
// Route: /api/data  (this file's path under /functions determines the route)
//
// Requires a KV namespace bound to this Pages project with the
// EXACT variable name: KBLI_DB
//   Cloudflare Dashboard -> Workers & Pages -> (this project) -> Settings
//   -> Functions -> KV namespace bindings -> Add binding
//   Variable name: KBLI_DB   Value: <pick or create a KV namespace>
//
// GET  /api/data  -> returns the current stored JSON (404 if nothing saved yet)
// POST /api/data  -> saves JSON body, but only if header X-Admin-Hash matches
//                    the adminPasswordHash currently stored (or the built-in
//                    default password's hash, if nothing has been saved yet).

const DEFAULT_ADMIN_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'; // sha256("admin123")
const KV_KEY = 'db';

function corsHeaders(){
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Hash',
    'Content-Type': 'application/json',
  };
}

export async function onRequestOptions(){
  return new Response(null, { headers: corsHeaders() });
}

export async function onRequestGet({ env }){
  if(!env.KBLI_DB){
    return new Response(JSON.stringify({ error: 'KV binding "KBLI_DB" belum diatur di Cloudflare Pages.' }), { status: 500, headers: corsHeaders() });
  }
  const raw = await env.KBLI_DB.get(KV_KEY);
  if(!raw){
    return new Response(JSON.stringify({ error: 'no data yet' }), { status: 404, headers: corsHeaders() });
  }
  return new Response(raw, { headers: corsHeaders() });
}

export async function onRequestPost({ request, env }){
  if(!env.KBLI_DB){
    return new Response(JSON.stringify({ error: 'KV binding "KBLI_DB" belum diatur di Cloudflare Pages.' }), { status: 500, headers: corsHeaders() });
  }

  const incomingHash = request.headers.get('X-Admin-Hash') || '';
  const raw = await env.KBLI_DB.get(KV_KEY);
  let current = null;
  if(raw){
    try{ current = JSON.parse(raw); }catch(e){ current = null; }
  }
  const expectedHash = (current && current.adminPasswordHash) ? current.adminPasswordHash : DEFAULT_ADMIN_HASH;

  if(incomingHash !== expectedHash){
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders() });
  }

  let body;
  try{
    body = await request.json();
  }catch(e){
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400, headers: corsHeaders() });
  }
  if(!body || typeof body !== 'object' || !body.companies){
    return new Response(JSON.stringify({ error: 'invalid payload: missing "companies"' }), { status: 400, headers: corsHeaders() });
  }

  await env.KBLI_DB.put(KV_KEY, JSON.stringify(body));
  return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders() });
}
