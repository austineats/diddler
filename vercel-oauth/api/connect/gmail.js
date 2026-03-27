export default function handler(req, res) {
  const phone = req.query.phone;
  if (!phone) return res.status(400).send("Missing phone");

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    response_type: "code",
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify",
    state: phone,
    access_type: "offline",
    prompt: "consent",
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Connect Gmail to Bit7</title>
  <meta property="og:title" content="Connect Gmail to Bit7">
  <meta property="og:description" content="Let Bit7 read and send emails on your behalf — all through iMessage.">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, sans-serif; background: #000; color: #fff; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; }
    .icon { font-size: 56px; margin-bottom: 20px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 10px; }
    p { color: #aaa; font-size: 15px; text-align: center; max-width: 300px; margin-bottom: 32px; line-height: 1.5; }
    a { background: #4285F4; color: #fff; font-weight: 700; font-size: 16px; padding: 16px 40px; border-radius: 50px; text-decoration: none; display: inline-block; }
    a:active { opacity: 0.85; }
    .perms { margin-top: 24px; max-width: 280px; }
    .perm { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; font-size: 13px; color: #888; }
    .check { color: #4285F4; font-weight: bold; }
  </style>
</head>
<body>
  <div class="icon">📧</div>
  <h1>Connect Gmail</h1>
  <p>Allow Bit7 to read and send emails on your behalf via iMessage.</p>
  <a href="${authUrl}">Sign in with Google</a>
  <div class="perms">
    <div class="perm"><span class="check">✓</span> Read your emails</div>
    <div class="perm"><span class="check">✓</span> Send emails for you</div>
    <div class="perm"><span class="check">✓</span> Search your inbox</div>
  </div>
</body>
</html>`);
}
