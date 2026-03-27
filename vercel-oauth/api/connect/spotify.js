export default function handler(req, res) {
  const phone = req.query.phone;
  if (!phone) return res.status(400).send("Missing phone");

  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    scope: "user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private streaming",
    state: phone,
  });

  const authUrl = `https://accounts.spotify.com/authorize?${params}`;

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Connect Spotify to Bit7</title>
  <meta property="og:title" content="Connect Spotify to Bit7">
  <meta property="og:description" content="Tap to link your Spotify — play music, skip tracks, and more via iMessage.">
  <meta property="og:image" content="https://vercel-oauth-kappa.vercel.app/og/spotify.png">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, sans-serif; background: #000; color: #fff; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; }
    .icon { font-size: 56px; margin-bottom: 20px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 10px; }
    p { color: #aaa; font-size: 15px; text-align: center; max-width: 300px; margin-bottom: 32px; line-height: 1.5; }
    a { background: #1DB954; color: #000; font-weight: 700; font-size: 16px; padding: 16px 40px; border-radius: 50px; text-decoration: none; display: inline-block; }
    a:active { opacity: 0.85; }
  </style>
</head>
<body>
  <div class="icon">🎵</div>
  <h1>Connect Spotify</h1>
  <p>Allow Bit7 to play music, skip tracks, and search Spotify on your behalf.</p>
  <a href="${authUrl}">Connect with Spotify</a>
</body>
</html>`);
}
