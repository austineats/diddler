export default function handler(req, res) {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Connect iCloud to Bit7</title>
  <meta property="og:title" content="Connect iCloud to Bit7">
  <meta property="og:description" content="Give Bit7 access to your contacts and calendar — no password sharing, uses Apple's secure app passwords.">
  <meta property="og:image" content="https://vercel-oauth-kappa.vercel.app/og/icloud.png">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, sans-serif; background: #000; color: #fff; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; }
    .icon { font-size: 56px; margin-bottom: 20px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 10px; }
    p { color: #aaa; font-size: 15px; text-align: center; max-width: 300px; line-height: 1.5; }
    .steps { margin: 24px 0 32px; text-align: left; max-width: 300px; width: 100%; }
    .step { display: flex; gap: 12px; margin-bottom: 16px; align-items: flex-start; }
    .num { background: #1a1a1a; border: 1px solid #333; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
    .step p { color: #ccc; font-size: 14px; margin: 0; }
    .step strong { color: #fff; }
    a.btn { background: #0071e3; color: #fff; font-weight: 600; font-size: 16px; padding: 16px 40px; border-radius: 50px; text-decoration: none; display: inline-block; }
    .code { background: #1a1a1a; border: 1px solid #333; border-radius: 10px; padding: 12px 16px; font-family: monospace; font-size: 13px; color: #aaa; margin-top: 24px; max-width: 300px; width: 100%; word-break: break-all; }
    .code span { color: #fff; }
  </style>
</head>
<body>
  <div class="icon">☁️</div>
  <h1>Connect iCloud</h1>
  <p>Uses Apple's secure app-specific passwords — your real password is never shared.</p>
  <div class="steps">
    <div class="step">
      <div class="num">1</div>
      <p>Tap the button below to open Apple's password page</p>
    </div>
    <div class="step">
      <div class="num">2</div>
      <p>Sign in → tap <strong>App-Specific Passwords</strong> → tap <strong>+</strong> → name it "Bit7" → copy the password</p>
    </div>
    <div class="step">
      <div class="num">3</div>
      <p>Text Bit7: <strong>connect icloud you@icloud.com xxxx-xxxx-xxxx-xxxx</strong></p>
    </div>
  </div>
  <a class="btn" href="https://appleid.apple.com/account/manage">Open Apple ID →</a>
  <div class="code">connect icloud <span>you@icloud.com xxxx-xxxx-xxxx-xxxx</span></div>
</body>
</html>`);
}
