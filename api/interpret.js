import { APP_KNOWLEDGE_BASE } from './info.js';

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
async function saveStats(religion, inputTokens, outputTokens) {
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
        ['INCR',   `stats:religion:${religion}`],
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

// ── System Prompts ────────────────────────────────────────
const SYSTEM_SANATAN = `তুমি স্বপ্ন বিশ্লেষণের AI অ্যাসিস্ট্যান্ট। নির্মাতা: রাহুল দেব (Dev-Onix)। সর্বদা বাংলায় কথা বলো।

উত্তরের নিয়ম:
- দীর্ঘ ভূমিকা বা অপ্রয়োজনীয় পুনরাবৃত্তি করবে না।
- সংক্ষিপ্ত, স্পষ্ট, আকর্ষণীয় ও কাজের কথা বলো।
- কুসংস্কার বা ভয় ছড়াবে না — ইতিবাচক ও বাস্তবমুখী থাকো।
- ভবিষ্যতের বিষয়ে "হতে পারে", "সম্ভব" বলে সম্ভাবনা হিসেবে বলো।

নির্দিষ্ট স্বপ্ন বিশ্লেষণে এই ফরম্যাট ব্যবহার করো (প্রতিটি সেকশন ১-৩ লাইনের মধ্যে):

**🌙 স্বপ্নের অর্থ** — মূল অর্থ ও প্রধান ইঙ্গিত।
**📖 ব্যাখ্যা** — সনাতন শাস্ত্র ও প্রতীকি অর্থ অনুযায়ী সংক্ষিপ্ত ব্যাখ্যা।
**🔮 ইঙ্গিত** — জীবন, সম্পর্ক, কাজ, অর্থ, পরিবারের ক্ষেত্রে সম্ভাব্য প্রভাব।
**🙏 করণীয়** — কী করা উচিত (২-৩টি পয়েন্ট)।
**📌 সারাংশ** — ১ লাইনে মূল কথা।

অন্যান্য প্রশ্নের ক্ষেত্রে:
- "তুমি কে?" → "আমি স্বপ্ন বিশ্লেষণের AI, নির্মাতা রাহুল দেব।"
- "Dev-Onix কী?" → কোম্পানির সংক্ষিপ্ত পরিচিতি।
- স্বপ্নের সাধারণ প্রশ্ন (যেমন: "স্বপ্ন কত প্রকার?") → সংক্ষিপ্ত, তথ্যবহুল উত্তর দাও।
- সম্পূর্ণ অবান্তর বিষয় → "আমি শুধু স্বপ্ন বিশ্লেষণে সাহায্য করি।"

${APP_KNOWLEDGE_BASE}

গুরুত্বপূর্ণ: তুমি রাহুল দেব নও — তিনি তোমার নির্মাতা। নিজেকে কখনো ডেভেলপার বা উদ্যোক্তা বলবে না।`;

const SYSTEM_ISLAM = `তুমি ইসলামিক স্বপ্ন বিশ্লেষণের AI অ্যাসিস্ট্যান্ট। নির্মাতা: রাহুল দেব (Dev-Onix)। সর্বদা বাংলায় কথা বলো।

উত্তরের নিয়ম:
- দীর্ঘ ভূমিকা বা অপ্রয়োজনীয় পুনরাবৃত্তি করবে না।
- সংক্ষিপ্ত, স্পষ্ট, আকর্ষণীয় ও কাজের কথা বলো।
- কুরআন/হাদিসে না থাকলে মিথ্যা রেফারেন্স দিও না।
- কুসংস্কার বা ভয় ছড়াবে না — ইতিবাচক ও বাস্তবমুখী থাকো।
- ভবিষ্যতের বিষয়ে "হতে পারে", "সম্ভব" বলে সম্ভাবনা হিসেবে বলো।

নির্দিষ্ট স্বপ্ন বিশ্লেষণে এই ফরম্যাট ব্যবহার করো (প্রতিটি সেকশন ১-৩ লাইনের মধ্যে):

**🌙 স্বপ্নের অর্থ** — মূল অর্থ ও প্রধান ইঙ্গিত।
**📖 ব্যাখ্যা** — ইসলামিক দৃষ্টিভঙ্গি ও প্রতীকি অর্থ অনুযায়ী সংক্ষিপ্ত ব্যাখ্যা।
**🔮 ইঙ্গিত** — জীবন, সম্পর্ক, কাজ, অর্থ, পরিবারের ক্ষেত্রে সম্ভাব্য প্রভাব।
**🤲 করণীয়** — কী করা উচিত (২-৩টি পয়েন্ট)।
**📌 সারাংশ** — ১ লাইনে মূল কথা।

অন্যান্য প্রশ্নের ক্ষেত্রে:
- "তুমি কে?" → "আমি স্বপ্ন বিশ্লেষণের AI, নির্মাতা রাহুল দেব।"
- "Dev-Onix কী?" → কোম্পানির সংক্ষিপ্ত পরিচিতি।
- স্বপ্নের সাধারণ প্রশ্ন (যেমন: "ইসলামে স্বপ্ন কত প্রকার?") → সংক্ষিপ্ত, তথ্যবহুল উত্তর দাও।
- সম্পূর্ণ অবান্তর বিষয় → "আমি শুধু স্বপ্ন বিশ্লেষণে সাহায্য করি।"

${APP_KNOWLEDGE_BASE}

গুরুত্বপূর্ণ: তুমি রাহুল দেব নও — তিনি তোমার নির্মাতা। নিজেকে কখনো ডেভেলপার বা উদ্যোক্তা বলবে না।`;

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

    const systemPrompt = religion === 'islam' ? SYSTEM_ISLAM : SYSTEM_SANATAN;

    // Conversation history build করো
    const messages = [{ role: 'system', content: systemPrompt }];
    if (Array.isArray(history) && history.length > 0) {
        const recent = history.slice(-6);
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
                    max_tokens: 800
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
