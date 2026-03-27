export default function handler(req, res) {
  const phone = req.query.phone;
  if (!phone) return res.status(400).send("Missing phone");

  const params = new URLSearchParams({
    client_id: process.env.UBER_CLIENT_ID,
    response_type: "code",
    redirect_uri: process.env.UBER_REDIRECT_URI,
    scope: "ride_request.estimate ride_request.receipt profile",
    state: phone,
  });

  const authUrl = `https://login.uber.com/oauth/v2/authorize?${params}`;

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Connect Uber to Bit7</title>
  <meta property="og:title" content="Connect Uber to Bit7">
  <meta property="og:description" content="Let Bit7 request rides and check prices — all through iMessage.">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, sans-serif; background: #000; color: #fff; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; }
    .icon { font-size: 56px; margin-bottom: 20px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 10px; }
    p { color: #aaa; font-size: 15px; text-align: center; max-width: 300px; margin-bottom: 32px; line-height: 1.5; }
    a { background: #fff; color: #000; font-weight: 700; font-size: 16px; padding: 16px 40px; border-radius: 50px; text-decoration: none; display: inline-block; }
    a:active { opacity: 0.85; }
  </style>
</head>
<body>
  <div class="icon">🚗</div>
  <h1>Connect Uber</h1>
  <p>Allow Bit7 to request rides and check prices on your behalf via iMessage.</p>
  <a href="${authUrl}">Sign in with Uber</a>
</body>
</html>`);
}
