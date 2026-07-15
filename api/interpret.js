import { APP_KNOWLEDGE_BASE } from './info.js'; // info.js ফাইলটি এখানে যুক্ত করা হলো

// ── Per-IP rate limit ─────────────────────────────────────
const ipMap = new Map();
function isRateLimited(ip) {
    const now = Date.now();
    const WINDOW = 60_000;
    const MAX = 15;
    const d = ipMap.get(ip);
    if (!d || now - d.start > WINDOW) { ipMap.set(ip, { count: 1, start: now }); return false; }
    if (d.count >= MAX) return true;
    d.count++;
    return false;
}
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of ipMap.entries()) if (now - v.start > 120_000) ipMap.delete(k);
}, 120_000);

// ── Stats সেভ করো ─────────────────────────────────────────
async function saveStats(inputTokens, outputTokens) {
    const url   = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return;

    const now      = new Date();
    const dateKey  = now.toISOString().slice(0, 10);
    const monthKey = now.toISOString().slice(0, 7);
    const totalTokens = (inputTokens || 0) + (outputTokens || 0);

    const cmds = [
        ['INCR',   `stats:searches:daily:${dateKey}`],
        ['INCR',   `stats:searches:monthly:${monthKey}`],
        ['INCR',   'stats:searches:total'],
        ['INCRBY', `stats:tokens:daily:${dateKey}`,   totalTokens],
        ['INCRBY', `stats:tokens:monthly:${monthKey}`, totalTokens],
        ['INCRBY', 'stats:tokens:total',               totalTokens],
        ['EXPIRE', `stats:searches:daily:${dateKey}`,  7776000],
        ['EXPIRE', `stats:tokens:daily:${dateKey}`,    7776000],
    ];

    try {
        await fetch(`${url}/pipeline`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(cmds)
        });
    } catch (e) { console.error('Stats save error:', e.message); }
}

// ── Track unique visitors ─────────────────────────────────
async function trackVisitor(ip) {
    const url   = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return;

    const dateKey  = new Date().toISOString().slice(0, 10);
    const monthKey = new Date().toISOString().slice(0, 7);

    try {
        await fetch(`${url}/pipeline`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify([
                ['PFADD', `stats:visitors:daily:${dateKey}`,   ip],
                ['PFADD', `stats:visitors:monthly:${monthKey}`, ip],
                ['PFADD', 'stats:visitors:total',               ip],
                ['EXPIRE', `stats:visitors:daily:${dateKey}`,  7776000],
            ])
        });
    } catch (e) {}
}

// ── System Prompt (Gemini Style, Multi-perspective & Token Optimized) ───
const SYSTEM_PROMPT = `আপনি একজন অভিজ্ঞ, সহানুভূতিশীল এবং যৌক্তিক স্বপ্ন বিশ্লেষক। আপনার নাম "Dream Lans", নির্মাতা স্বাধীন ডেভেলপার "রাহুল দেব"।

আপনার চিন্তার লজিক বা বিশ্লেষণ পদ্ধতি (Google Gemini-এর মতো):
১. প্রতীকী ডিকনস্ট্রাকশন (Symbolic Deconstruction): স্বপ্নের বর্ণনা থেকে মূল 'প্রতীক' বা 'ঘটনা' আলাদা করুন। 
২. বহুমুখী দৃষ্টিভঙ্গি (Multi-perspective Analysis): স্বপ্নটিকে মনস্তাত্ত্বিক (Psychological), সাংস্কৃতিক (Cultural) এবং সাধারণ আধ্যাত্মিক এই তিনটি ভিন্ন দৃষ্টিকোণ থেকে বিশ্লেষণ করুন।
৩. ব্যালেন্সিং (The Balancing Act): কখনোই কোনো অর্থকে চূড়ান্ত বলে দাবি করবেন না। "হতে পারে", "সম্ভাবনা থাকে", "মনোবিজ্ঞানীদের মতে" বা "প্রচলিত বিশ্বাস অনুযায়ী" শব্দগুলো ব্যবহার করবেন। ইউজারকে আতঙ্কিত না করে বরং নিজের জীবন নিয়ে ভাবতে সাহায্য করবেন।

শৈলী ও নিয়ম:
- জেমিনির মতো বন্ধুত্বপূর্ণ, সাবলীল, বাস্তবমুখী ও ইতিবাচক বাংলায় উত্তর দিন। 
- কোনো নির্দিষ্ট ধর্ম, শাস্ত্র, গ্রন্থ, দেবদেবী, সম্প্রদায় বা ধর্মগ্রন্থের নাম (যেমন: বেদ, পুরাণ, কুরআন, হাদিস, বাইবেল, সনাতন, ইসলাম, হিন্দু ইত্যাদি) কখনোই উল্লেখ করবেন না। ধর্মীয় ও সাংস্কৃতিক প্রেক্ষাপটটি সার্বজনীন ও লোকজ বিশ্বাসের আলোকে লিখবেন।
- টোকেন বাঁচাতে অপ্রয়োজনীয় দীর্ঘ ভূমিকা বাদ দিন।

বিশেষ নির্দেশ (অবশ্যই পালনীয়):
১. নিজের পরিচয়: ইউজার আপনার পরিচয় বা কে তৈরি করেছে জানতে চাইলে বলবেন: "আমি স্বপ্ন বিশ্লেষণ করার একটি এআই অ্যাসিস্ট্যান্ট (Dream Lans), আমাকে তৈরি করেছেন স্বাধীন ডেভেলপার রাহুল দেব।"
২. অবান্তর প্রশ্ন: স্বপ্নের বাইরের কোনো বিষয় জিজ্ঞাসা করলে অত্যন্ত সংক্ষেপে বলুন: "দুঃখিত, আমার নির্মাতা রাহুল দেব আমাকে স্বপ্নের অর্থ ব্যাখ্যা ও স্বপ্ন সংক্রান্ত বিষয় ছাড়া অন্য বিষয়ের উত্তর বা সমস্যার সমাধান করার অনুমতি দেননি।"

আপনি উত্তরের জন্য নিচের ফরম্যাটটি হুবহু ব্যবহার করবেন (Markdown সাপোর্ট সহ):

### 🌌 স্বপ্নের শিরোনাম
[একটি সংক্ষিপ্ত আকর্ষণীয় শিরোনাম]

---
### 🧠 মনস্তাত্ত্বিক ব্যাখ্যা
[অবচেতন মন, আকাঙ্ক্ষা বা ভয়ের দৃষ্টিকোণ থেকে আপনার বিশ্লেষণ...]

---
### 📖 ধর্মীয় ও সাংস্কৃতিক প্রেক্ষাপট
[প্রচলিত বিশ্বাস ও সার্বজনীন আধ্যাত্মিক দৃষ্টিকোণ থেকে আপনার বিশ্লেষণ (কোনো নির্দিষ্ট ধর্মের নাম উল্লেখ ছাড়া)...]

---
### 💡 বাস্তব জীবনের পরামর্শ
[ব্যবহারকারীর জন্য বাস্তব জীবনের সাথে মিলিয়ে গঠনমূলক টিপস এবং শেষে তাকে চিন্তাভাবনা করার জন্য ১টি ছোট প্রাসঙ্গিক প্রশ্ন...]

${APP_KNOWLEDGE_BASE}`;

// ── Main handler ──────────────────────────────────────────
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
             || req.socket?.remoteAddress || 'unknown';

    if (isRateLimited(ip)) {
        return res.status(429).json({ error: 'অনেক বেশি request। ১ মিনিট পর আবার চেষ্টা করুন।' });
    }

    const { dream, history } = req.body || {};

    if (!dream || typeof dream !== 'string' || dream.trim().length < 2) {
        return res.status(400).json({ error: 'স্বপ্নের বর্ণনা বা আপনার প্রশ্নটি লিখুন।' });
    }
    if (dream.length > 2000) {
        return res.status(400).json({ error: 'আপনার লেখা ২০০০ অক্ষরের মধ্যে লিখুন।' });
    }

    const KEYS = [
        process.env.GROQ_API_KEY_1,
        process.env.GROQ_API_KEY_2,
        process.env.GROQ_API_KEY_3,
    ].filter(Boolean);

    if (KEYS.length === 0) return res.status(500).json({ error: 'Server configuration error' });

    // Random key দিয়ে শুরু — load balance
    const start = Math.floor(Math.random() * KEYS.length);
    const keys  = [...KEYS.slice(start), ...KEYS.slice(0, start)];

    // Conversation history build করো
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    if (Array.isArray(history) && history.length > 0) {
        const recent = history.slice(-4); // হিস্ট্রি আরও সংকুচিত করা হলো টোকেন বাঁচাতে
        for (const msg of recent) {
            if (msg.role === 'user') messages.push({ role: 'user', content: msg.text });
            else if (msg.role === 'ai') messages.push({ role: 'assistant', content: msg.text });
        }
    }
    messages.push({ role: 'user', content: dream.trim() });

    // Visitor track (async)
    trackVisitor(ip).catch(() => {});

    for (let i = 0; i < keys.length; i++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 28000);

            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${keys[i]}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages,
                    temperature: 0.7, 
                    max_tokens: 2500 
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (groqRes.status === 429 || groqRes.status === 503) continue;

            if (!groqRes.ok) {
                const err = await groqRes.json().catch(() => ({}));
                throw new Error(err?.error?.message || `Groq error ${groqRes.status}`);
            }

            const data = await groqRes.json();
            const text = data?.choices?.[0]?.message?.content?.trim();
            if (!text) throw new Error('Empty response');

            // Stats সেভ করো (async)
            const usage = data.usage || {};
            saveStats(
                usage.prompt_tokens || 0,
                usage.completion_tokens || 0
            ).catch(() => {});

            return res.status(200).json({ text });

        } catch (e) {
            if (e.name === 'AbortError') {
                if (i < keys.length - 1) continue;
                return res.status(504).json({ error: 'AI সার্ভার সময়মতো সাড়া দেয়নি। আবার চেষ্টা করুন।' });
            }
            if (i < keys.length - 1) continue;
            return res.status(500).json({ error: `AI ত্রুটি: ${e.message}` });
        }
    }

    return res.status(429).json({ error: 'সব API key এর limit শেষ। কিছুক্ষণ পর আবার চেষ্টা করুন।' });
              }
