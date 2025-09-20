// server.js
const express = require('express');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');
const path = require('path');


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));


// Basic rate limiter
const limiter = rateLimit({
windowMs: 60 * 1000, // 1 minute
max: 30, // max 30 requests per minute per IP
});
app.use(limiter);


// Utility: validate TikTok url
function isTikTokUrl(url) {
try {
const u = new URL(url);
return /tiktok.com/i.test(u.hostname) || /vm.tiktok.com/i.test(u.hostname);
} catch (e) {
return false;
}
}


// POST /api/get-video
// body: { url: 'https://www.tiktok.com/...' }
app.post('/api/get-video', async (req, res) => {
const { url } = req.body;
if (!url || !isTikTokUrl(url)) return res.status(400).json({ error: 'Invalid TikTok URL' });


try {
// Fetch page HTML
const resp = await fetch(url, {
headers: {
'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
'Accept-Language': 'en-US,en;q=0.9'
}
});
if (!resp.ok) return res.status(502).json({ error: 'Failed to fetch TikTok page' });


const html = await resp.text();


// Try to find a video URL in the page JSON
// TikTok often inlines JSON with "playAddr" or a <video> tag with src
let videoUrl = null;


// 1) Search for playAddr in JSON
let m = html.match(/"playAddr"\s*:\s*"(https?:\\/\\/[^\"]+)"/);
if (m && m[1]) {
videoUrl = m[1].replace(/\\/g, '');
}


// 2) Fallback: find <video src="..."> tag
if (!videoUrl) {
m = html.match(/<video[^>]+src=["']([^"']+)["']/i);
if (m && m[1]) videoUrl = m[1];
}


// 3) Another fallback: look for "playAddr":"https..." without escapes
if (!videoUrl) {
m = html.match(/playAddr:\s*\"(https?:\\/\\/[^"]+)\"/);
if (m && m[1]) videoUrl = m[1].replace(/\\/g, '');
}


if (!videoUrl) {
return res.status(404).json({ error: 'Video URL not found. TikTok markup may have changed.' });
}


// Some URLs may contain query params that prevent direct download; we can try to fetch and stream
// Option A: return the direct URL so the client can download
return res.json({ video: videoUrl });


// Option B (alternative): stream the video via backend (uncomment to enable)
// const vresp = await fetch(videoUrl, { headers: { 'User-Agent': 'okhttp/3.12.1' } });
// if (!vresp.ok) return res.status(502).json({ error: 'Failed to fetch video file' });
// res.set('Content-Type', vresp.headers.get('content-type') || 'video/mp4');
// vresp.body.pipe(res);


} catch (err) {
console.error(err);
res.status(500).json({ error: 'Server error' });
}
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
