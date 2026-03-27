import postgres from "postgres";

export default async function handler(req, res) {
  const phone = req.query.phone;
  if (!phone) return res.status(400).send("Missing phone");

  const sql = postgres(process.env.DATABASE_URL);
  await sql`
    INSERT INTO oauth_tokens (id, user_phone, service, access_token, created_at)
    VALUES (gen_random_uuid(), ${phone}, 'shortcuts', 'enabled', now())
    ON CONFLICT (user_phone, service)
    DO UPDATE SET access_token = 'enabled'
  `;
  await sql.end();

  res.send(`
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="font-family:system-ui;text-align:center;padding:60px 20px;background:#000;color:#fff">
        <div style="font-size:48px">✓</div>
        <h2>Shortcuts connected!</h2>
        <p style="color:#aaa">Go back to iMessage — you can now set alarms, control music, and more.</p>
      </body>
    </html>
  `);
}
