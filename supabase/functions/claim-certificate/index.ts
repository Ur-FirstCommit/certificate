import { createClient } from "npm:@supabase/supabase-js@2";

function defaultKeySet(variable: string): string | undefined {
  try {
    const keys = JSON.parse(Deno.env.get(variable) ?? "{}") as Record<string, string>;
    return keys.default;
  } catch {
    return undefined;
  }
}

const projectUrl = Deno.env.get("SUPABASE_URL");
const publishableKey = defaultKeySet("SUPABASE_PUBLISHABLE_KEYS") ?? Deno.env.get("SUPABASE_ANON_KEY");
const serviceRoleKey = defaultKeySet("SUPABASE_SECRET_KEYS") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const allowedOrigins = new Set(
  (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function responseHeaders(origin: string | null): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  });
  if (origin && allowedOrigins.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function json(body: Record<string, unknown>, status: number, origin: string | null): Response {
  const headers = responseHeaders(origin);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const headers = responseHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: origin && !allowedOrigins.has(origin) ? 403 : 204, headers });
  }
  if (origin && !allowedOrigins.has(origin)) return json({ error: "Origin not allowed." }, 403, origin);
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  if (!projectUrl || !publishableKey || !serviceRoleKey) {
    console.error("Claim function is missing required Supabase environment configuration.");
    return json({ error: "Certificate claims are temporarily unavailable." }, 500, origin);
  }

  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return json({ error: "A verified sign-in is required." }, 401, origin);

  try {
    const userClient = createClient(projectUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
    const user = userData.user;
    if (userError || !user?.email || !user.email_confirmed_at) {
      return json({ error: "Verify your email before claiming a certificate." }, 401, origin);
    }

    const payload = await request.json().catch(() => null);
    const fullName = typeof payload?.fullName === "string" ? payload.fullName.trim().replace(/\s+/g, " ") : "";
    if (fullName.length < 2 || fullName.length > 100) {
      return json({ error: "Enter a name between 2 and 100 characters." }, 400, origin);
    }

    const admin = createClient(projectUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const email = user.email.trim().toLowerCase();
    const { data: winner, error: lookupError } = await admin
      .from("certificate_winners")
      .select("award_name")
      .eq("email", email)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const certificateType = winner ? "award" : "participation";
    const awardName = winner?.award_name ?? null;
    const { data: claim, error: claimError } = await admin
      .from("certificate_claims")
      .upsert({
        auth_user_id: user.id,
        email,
        full_name: fullName,
        certificate_type: certificateType,
        award_name: awardName,
        updated_at: new Date().toISOString(),
      }, { onConflict: "email" })
      .select("id")
      .single();
    if (claimError) throw claimError;

    return json({
      claimId: claim.id,
      certificateType,
      awardName,
    }, 200, origin);
  } catch (error) {
    console.error("Certificate claim failed.");
    return json({ error: "We couldn’t complete your claim. Please try again." }, 500, origin);
  }
});
