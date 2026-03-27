import postgres from "postgres";

export default async function handler(req, res) {
  const { code, state: phone, error } = req.query;

  if (error || !code || !phone) {
    return res.status(400).send("Authorization failed or was cancelled.");
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    }),
  });

  if (!tokenRes.ok) {
    console.error("Spotify token exchange failed:", await tokenRes.text());
    return res.status(500).send("Failed to connect Spotify. Please try again.");
  }

  const { access_token, refresh_token, expires_in } = await tokenRes.json();
  const expires_at = new Date(Date.now() + expires_in * 1000);

  // Store in Neon DB
  const sql = postgres(process.env.DATABASE_URL);
  await sql`
    INSERT INTO oauth_tokens (id, user_phone, service, access_token, refresh_token, expires_at, created_at)
    VALUES (gen_random_uuid(), ${phone}, 'spotify', ${access_token}, ${refresh_token}, ${expires_at}, now())
    ON CONFLICT (user_phone, service)
    DO UPDATE SET access_token = ${access_token}, refresh_token = ${refresh_token}, expires_at = ${expires_at}
  `;
  await sql.end();

  res.send(`
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="font-family:system-ui;text-align:center;padding:60px 20px;background:#000;color:#fff">
        <div style="font-size:48px">✓</div>
        <h2>Spotify connected!</h2>
        <p style="color:#aaa">You can close this page and go back to iMessage.</p>
      </body>
    </html>
  `);
}
