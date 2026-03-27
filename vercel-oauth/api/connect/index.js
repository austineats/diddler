export default function handler(req, res) {
  const phone = req.query.phone || "";
  const qs = phone ? `?phone=${encodeURIComponent(phone)}` : "";

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bit7 — Connect Your Services</title>
  <meta property="og:title" content="Connect Your Services to Bit7">
  <meta property="og:description" content="Link your accounts so Bit7 can manage music, email, rides, and more — all through iMessage.">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, sans-serif; background: #000; color: #fff; min-height: 100vh; padding: 40px 20px; }
    .container { max-width: 400px; margin: 0 auto; }
    h1 { font-size: 28px; font-weight: 700; text-align: center; margin-bottom: 8px; }
    .subtitle { color: #888; font-size: 14px; text-align: center; margin-bottom: 32px; }
    .service { display: flex; align-items: center; gap: 16px; background: #111; border: 1px solid #222; border-radius: 16px; padding: 16px 20px; margin-bottom: 12px; text-decoration: none; color: #fff; transition: border-color 0.2s; }
    .service:active { border-color: #555; }
    .icon { font-size: 32px; width: 44px; text-align: center; flex-shrink: 0; }
    .info { flex: 1; }
    .info h3 { font-size: 16px; font-weight: 600; margin-bottom: 2px; }
    .info p { font-size: 13px; color: #888; }
    .arrow { color: #555; font-size: 20px; }
    .section { color: #555; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 12px 4px; }
    .connected { border-color: #1DB954; }
    .badge { font-size: 11px; color: #1DB954; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Connect Services</h1>
    <p class="subtitle">Link accounts so Bit7 can act on your behalf</p>

    <div class="section">Music</div>
    <a class="service" href="/connect/spotify${qs}">
      <div class="icon">🎵</div>
      <div class="info">
        <h3>Spotify</h3>
        <p>Play, pause, skip, search music</p>
      </div>
      <div class="arrow">›</div>
    </a>

    <div class="section">Communication</div>
    <a class="service" href="/connect/gmail${qs}">
      <div class="icon">📧</div>
      <div class="info">
        <h3>Gmail</h3>
        <p>Read, search, send emails</p>
      </div>
      <div class="arrow">›</div>
    </a>
    <a class="service" href="/connect/icloud${qs}">
      <div class="icon">☁️</div>
      <div class="info">
        <h3>iCloud</h3>
        <p>Contacts, calendar, reminders</p>
      </div>
      <div class="arrow">›</div>
    </a>

    <div class="section">Transportation</div>
    <a class="service" href="/connect/uber${qs}">
      <div class="icon">🚗</div>
      <div class="info">
        <h3>Uber</h3>
        <p>Request rides, check prices</p>
      </div>
      <div class="arrow">›</div>
    </a>

    <div class="section">Smart Home</div>
    <a class="service" href="/connect/google-home${qs}">
      <div class="icon">🏠</div>
      <div class="info">
        <h3>Google Home</h3>
        <p>Control lights, locks, thermostat</p>
      </div>
      <div class="arrow">›</div>
    </a>

    <p style="color:#444; font-size:12px; text-align:center; margin-top:32px;">Bit7 only requests the minimum permissions needed.<br>You can disconnect any service at any time.</p>
  </div>
</body>
</html>`);
}
