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

// ── Upstash Redis helper ──────────────────────────────────
async function redisCmd(url, token, ...args) {
    try {
        const r = await fetch(`${url}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(args)
        });
        const d = await r.json();
        return d.result;
    } catch (e) {
        console.error('Redis error:', e.message);
        return null;
    }
}

// ── Stats সেভ করো ─────────────────────────────────────────
async function saveStats(religion, inputTokens, outputTokens) {
    const url   = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return;

    const now     = new Date();
    const dateKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const monthKey= now.toISOString().slice(0, 7);  // YYYY-MM
    const totalTokens = (inputTokens || 0) + (outputTokens || 0);

    // Pipeline — একসাথে সব update
    const cmds = [
        // দৈনিক সার্চ count
        ['INCR', `stats:searches:daily:${dateKey}`],
        // মাসিক সার্চ count
        ['INCR', `stats:searches:monthly:${monthKey}`],
        // মোট সার্চ
        ['INCR', 'stats:searches:total'],
        // দৈনিক token
        ['INCRBY', `stats:tokens:daily:${dateKey}`, totalTokens],
        // মাসিক token
        ['INCRBY', `stats:tokens:monthly:${monthKey}`, totalTokens],
        // মোট token
        ['INCRBY', 'stats:tokens:total', totalTokens],
        // ধর্ম অনুযায়ী count
        ['INCR', `stats:religion:${religion}`],
        // unique ইউজার track এর জন্য daily key এর expire সেট করো (৯০ দিন)
        ['EXPIRE', `stats:searches:daily:${dateKey}`, 7776000],
        ['EXPIRE', `stats:tokens:daily:${dateKey}`, 7776000],
    ];

    try {
        await fetch(`${url}/pipeline`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cmds)
        });
    } catch (e) {
        console.error('Stats save error:', e.message);
    }
}

// ── Track unique visitors (IP hash) ───────────────────────
async function trackVisitor(ip) {
    const url   = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return;

    const dateKey  = new Date().toISOString().slice(0, 10);
    const monthKey = new Date().toISOString().slice(0, 7);

    // HyperLogLog দিয়ে unique visitor count (memory efficient)
    try {
        await fetch(`${url}/pipeline`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify([
                ['PFADD', `stats:visitors:daily:${dateKey}`, ip],
                ['PFADD', `stats:visitors:monthly:${monthKey}`, ip],
                ['PFADD', 'stats:visitors:total', ip],
                ['EXPIRE', `stats:visitors:daily:${dateKey}`, 7776000],
            ])
        });
    } catch (e) {}
}

// ── System Prompts ────────────────────────────────────────
const SYSTEM_SANATAN = `আপনি একজন অভিজ্ঞ সনাতন স্বপ্নশাস্ত্র বিশেষজ্ঞ। আপনার কাজ স্বপ্ন বিশ্লেষণ করা।

গুরুত্বপূর্ণ নিয়ম:
- সর্বদা বাংলায় উত্তর দিবেন
- ইউজারের আগের স্বপ্নগুলো মনে রেখে নতুন স্বপ্নের সাথে মিলিয়ে বিশ্লেষণ করবেন
- কখনো উত্তর অসম্পূর্ণ রাখবেন না
- ভয় বা কুসংস্কার ছড়াবেন না
- ভবিষ্যদ্বাণী সম্ভাব্য হিসেবে উপস্থাপন করবেন
- ইউজার যদি স্বপ্ন বাদে অন্য কিছু সার্চ করে, তাহলে তাকে সুন্দর করে বুঝিয়ে বলেন, যে আপনি শুধু স্বপ্নের অর্থ বিশ্লেষণ করেন, অন্য কিছু Dreem app এর নির্মাতা রাহুল দেভ আপনাকে পার্মিশন দেয়নি

প্রতিটি উত্তর ঠিক এই কাঠামোতে দিবেন:

🌙 **স্বপ্নের অর্থ**
(২-৩ লাইনে সংক্ষেপে মূল অর্থ বলুন)

📖 **শাস্ত্র কী বলে**
(সনাতন শাস্ত্র, পুরাণ বা উপনিষদ অনুযায়ী ৩-৪ লাইনে সংক্ষেপে বলুন। আগের স্বপ্নের সাথে মিল থাকলে উল্লেখ করুন)

🔮 **আপনার জীবনে কী আসতে পারে**
(বিস্তারিতভাবে বলুন — কাজ, সম্পর্ক, স্বাস্থ্য, অর্থনীতি, পরিবার — যেটা প্রাসঙ্গিক। আগের স্বপ্নের pattern থাকলে উল্লেখ করুন)

🙏 **এখন আপনার করণীয়**
(বিস্তারিতভাবে বলুন — কোন পূজা, কোন মন্ত্র, কোন দান, কোন আচার, কীভাবে করবেন, কতদিন করবেন,কি কি বিষয় সতর্ক বা খুশি থাকবেন,কি ধরনের কাজে লিপ্ত হবেন)

📌 **উপসংহার**
(২-৩ লাইনে সারমর্ম)

❓ **আপনার জন্য কিছু প্রশ্ন**
(স্বপ্নের বিষয়বস্তু অনুযায়ী ২-৩টি আকর্ষণীয় প্রশ্ন করুন)`;

const SYSTEM_ISLAM = `আপনি একজন অভিজ্ঞ ইসলামিক স্বপ্ন বিশ্লেষক। আপনার কাজ স্বপ্ন বিশ্লেষণ করা।

গুরুত্বপূর্ণ নিয়ম:
- সর্বদা বাংলায় উত্তর দিবেন
- ইউজারের আগের স্বপ্নগুলো মনে রেখে নতুন স্বপ্নের সাথে মিলিয়ে বিশ্লেষণ করবেন
- কখনো উত্তর অসম্পূর্ণ রাখবেন না
- ভয় বা কুসংস্কার ছড়াবেন না
- ভবিষ্যদ্বাণী সম্ভাব্য হিসেবে উপস্থাপন করবেন
- ইসলাম ধর্ম গ্রন্থে কোন স্বপ্নের অর্থ বিস্তারিত ভাবে বলা নেই, তাই আপনি সনাতন ধর্ম গ্রন্থ ব্যাবহার করবেন, কিন্তু ইউজার যাতে বুঝতে না পারে যে 
 আপনি সনাতন ধর্ম গ্রন্থ ব্যাবহার করতেছেন, তাই সেইদিকে লক্ষ রাখবেন
- ইউজার যদি স্বপ্ন বাদে অন্য কিছু সার্চ করে, তাহলে তাকে সুন্দর করে বুঝিয়ে বলেন, যে আপনি শুধু স্বপ্নের অর্থ বিশ্লেষণ করেন, অন্য কিছু করতে Dreem app এর নির্মাতা রাহুল দেভ আপনাকে পার্মিশন দেয়নি

প্রতিটি উত্তর ঠিক এই কাঠামোতে দিবেন:

🌙 **স্বপ্নের অর্থ**
(২-৩ লাইনে সংক্ষেপে মূল অর্থ বলুন)

📖 **শাস্ত্র কী বলে**
(ইসলামিক স্বপ্ন ব্যাখ্যার আলোকে ২-৩ লাইনে সংক্ষেপে বলুন। আগের স্বপ্নের সাথে মিল থাকলে উল্লেখ করুন)

🔮 **আপনার জীবনে কী আসতে পারে**
(বিস্তারিতভাবে বলুন — কাজ, সম্পর্ক, স্বাস্থ্য, অর্থনীতি, পরিবার — যেটা প্রাসঙ্গিক। আগের স্বপ্নের pattern থাকলে উল্লেখ করুন)

🙏 **এখন আপনার করণীয়**
(বিস্তারিতভাবে বলুন — কোন দোয়া, কোন সুরা, কতবার, কখন, কী আমল, কী সদকা, কি কি বিষয় সতর্ক বা খুশি থাকবেন)

📌 **উপসংহার**
(২-৩ লাইনে সারমর্ম)

❓ **আপনার জন্য কিছু প্রশ্ন**
(স্বপ্নের বিষয়বস্তু অনুযায়ী ২-৩টি আকর্ষণীয় প্রশ্ন করুন)`;

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

    const { dream, religion, history } = req.body || {};

    if (!dream || typeof dream !== 'string' || dream.trim().length < 3) {
        return res.status(400).json({ error: 'স্বপ্নের বর্ণনা প্রয়োজন' });
    }
    if (dream.length > 2000) {
        return res.status(400).json({ error: 'স্বপ্নের বর্ণনা ২০০০ অক্ষরের মধ্যে লিখুন।' });
    }

    const KEYS = [
        process.env.GROQ_API_KEY_1,
        process.env.GROQ_API_KEY_2,
        process.env.GROQ_API_KEY_3,
    ].filter(Boolean);

    if (KEYS.length === 0) return res.status(500).json({ error: 'Server configuration error' });

    const start = Math.floor(Math.random() * KEYS.length);
    const keys  = [...KEYS.slice(start), ...KEYS.slice(0, start)];

    const systemPrompt = religion === 'islam' ? SYSTEM_ISLAM : SYSTEM_SANATAN;

    const messages = [{ role: 'system', content: systemPrompt }];
    if (Array.isArray(history) && history.length > 0) {
        const recent = history.slice(-6);
        for (const msg of recent) {
            if (msg.role === 'user') messages.push({ role: 'user', content: msg.text });
            else if (msg.role === 'ai') messages.push({ role: 'assistant', content: msg.text });
        }
    }
    messages.push({ role: 'user', content: `স্বপ্ন: "${dream.trim()}"` });

    // Visitor track (async — response কে block করবে না)
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
                    temperature: 0.8,
                    max_tokens: 3000
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

            // Stats সেভ করো (async — response কে block করবে না)
            const usage = data.usage || {};
            saveStats(
                religion || 'sanatan',
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
