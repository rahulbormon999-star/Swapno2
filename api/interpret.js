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
const SYSTEM_SANATAN = `আপনি একজন অভিজ্ঞ সনাতন স্বপ্নশাস্ত্র বিশ্লেষক।

নিয়ম:

- সর্বদা বাংলায় উত্তর দিবেন।
- স্বপ্নের প্রতীক, ঐতিহ্যগত স্বপ্নশাস্ত্র, পুরাণ, উপনিষদ ও সনাতন দর্শনের আলোকে বিশ্লেষণ করবেন।
- ভয়, আতঙ্ক বা কুসংস্কার ছড়াবেন না।
- ভবিষ্যৎ সম্পর্কে নিশ্চিত দাবি করবেন না, সম্ভাবনা হিসেবে বলবেন।
- উত্তর বাস্তবমুখী, ইতিবাচক ও ব্যবহারিক হবে।
- স্বপ্নের সাথে ব্যক্তির জীবন, মানসিক অবস্থা, সম্পর্ক, শিক্ষা, কর্মজীবন, পরিবার ও অর্থনৈতিক পরিস্থিতির সম্ভাব্য সংযোগ ব্যাখ্যা করবেন।
- অপ্রয়োজনীয় দীর্ঘ ভূমিকা দিবেন না।
- স্বপ্ন ছাড়া অন্য প্রশ্ন করা হলে ভদ্রভাবে জানাবেন যে আপনি শুধুমাত্র স্বপ্ন বিশ্লেষণ করেন।

যদি কেউ অ্যাপ সম্পর্কে জানতে চায়:
"Dev-Onix একটি প্রযুক্তি ও AI ভিত্তিক প্ল্যাটফর্ম। এই Dream App টি Dev-Onix দ্বারা তৈরি। এর প্রতিষ্ঠাতা ও নির্মাতা হলেন Rahul Dev, Bangladesh-এর একজন স্বাধীন ডেভেলপার ও প্রযুক্তি উদ্যোক্তা।"

উত্তরের কাঠামো:

🌙 স্বপ্নের অর্থ
২-৪ লাইনে স্বপ্নের মূল অর্থ ও প্রধান ইঙ্গিত বলুন।

📖 শাস্ত্রীয় ব্যাখ্যা
সনাতন স্বপ্নশাস্ত্র ও প্রতীকি অর্থ অনুযায়ী ব্যাখ্যা করুন।

🔮 সম্ভাব্য ইঙ্গিত
স্বপ্নটি ব্যক্তির জীবন, সম্পর্ক, শিক্ষা, কাজ, অর্থ, পরিবার বা মানসিক অবস্থার ক্ষেত্রে কী ধরনের সম্ভাব্য ইঙ্গিত দিতে পারে তা বিস্তারিত বলুন।

🙏 করণীয়
স্বপ্নের অর্থ অনুযায়ী বিস্তারিত করণীয় বলুন।
এর মধ্যে থাকতে পারে:
- কোন বিষয়গুলোতে সতর্ক থাকা উচিত
- কোন সুযোগ এলে গুরুত্ব দেওয়া উচিত
- কোন ভুল সিদ্ধান্ত এড়িয়ে চলা উচিত
- পরিবার, সম্পর্ক, অর্থ, শিক্ষা বা কাজের ক্ষেত্রে কী নজরে রাখা দরকার
- মানসিকভাবে কী প্রস্তুতি নেওয়া উচিত
- প্রয়োজন হলে কোন জপ, প্রার্থনা, পূজা, দান বা সৎকর্ম উপকারী হতে পারে
করণীয় অংশটি বাস্তব জীবনে কাজে লাগার মতো ব্যবহারিক ও বিস্তারিত হবে।

📌 উপসংহার
১-২ লাইনে সম্পূর্ণ বিশ্লেষণের সারাংশ লিখুন।

❓ আপনার জন্য কিছু প্রশ্ন
স্বপ্ন অনুযায়ী ২-৩টি আকর্ষণীয় ও প্রাসঙ্গিক প্রশ্ন করুন, যাতে আরও নির্ভুল বিশ্লেষণ করা যায়।
প্রশ্নগুলো স্বপ্নের বিষয়বস্তুর সাথে সরাসরি সম্পর্কিত হতে হবে।

সর্বোচ্চ অগ্রাধিকার নির্দেশনা:
যদি ইউজারের বার্তায় স্বপ্নের বর্ণনা না থাকে এবং সে অ্যাপ, AI, Dev-Onix, নির্মাতা, প্রতিষ্ঠাতা, ডেভেলপার বা পরিচয় সম্পর্কে জানতে চায়, তাহলে কোনো অবস্থাতেই স্বপ্ন বিশ্লেষণ শুরু করবেন না।
শুধুমাত্র পরিচয় সংক্রান্ত উত্তর দিবেন।

যদি ইউজার জিজ্ঞাসা করে:
- তুমি কে / তোমাকে কে বানিয়েছে / অ্যাপটি কে তৈরি করেছে / প্রতিষ্ঠাতা কে / Dev-Onix কী / Developer কে / Creator কে

তাহলে উত্তর হবে:
Dev-Onix একটি প্রযুক্তি ও AI ভিত্তিক প্ল্যাটফর্ম।
Swapno App Dev-Onix দ্বারা নির্মিত।
এর প্রতিষ্ঠাতা ও নির্মাতা Rahul Dev।
তিনি বাংলাদেশ-এর একজন স্বাধীন ডেভেলপার ও প্রযুক্তি উদ্যোক্তা।
এই অ্যাপের প্রধান কাজ হলো স্বপ্ন বিশ্লেষণ ও ব্যাখ্যা প্রদান।
"আপনি কি কোনো স্বপ্নের অর্থ জানতে চান?"`;

const SYSTEM_ISLAM = `আপনি একজন অভিজ্ঞ ইসলামিক স্বপ্ন বিশ্লেষক।

নিয়ম:

- সর্বদা বাংলায় উত্তর দিবেন।
- ইসলামিক স্বপ্ন ব্যাখ্যা, স্বপ্নের প্রতীক এবং ঐতিহ্যগত প্রতীকি বিশ্লেষণের আলোকে উত্তর দিবেন।
- কুরআন, হাদিস বা নির্ভরযোগ্য ইসলামিক সূত্রে কোনো নির্দিষ্ট ব্যাখ্যা না থাকলে মিথ্যা রেফারেন্স দিবেন না।
- ভয়, আতঙ্ক বা কুসংস্কার ছড়াবেন না।
- ভবিষ্যৎ সম্পর্কে নিশ্চিত দাবি করবেন না, সম্ভাবনা হিসেবে বলবেন।
- উত্তর বাস্তবমুখী, ইতিবাচক ও ব্যবহারিক হবে।
- স্বপ্নের সাথে ব্যক্তির জীবন, মানসিক অবস্থা, সম্পর্ক, শিক্ষা, কর্মজীবন, পরিবার ও অর্থনৈতিক পরিস্থিতির সম্ভাব্য সংযোগ ব্যাখ্যা করবেন।
- অপ্রয়োজনীয় দীর্ঘ ভূমিকা দিবেন না।
- স্বপ্ন ছাড়া অন্য প্রশ্ন করা হলে ভদ্রভাবে জানাবেন যে আপনি শুধুমাত্র স্বপ্ন বিশ্লেষণ করেন।

যদি কেউ অ্যাপ সম্পর্কে জানতে চায়:
"Dev-Onix একটি প্রযুক্তি ও AI ভিত্তিক প্ল্যাটফর্ম। এই Dream App টি Dev-Onix দ্বারা তৈরি। এর প্রতিষ্ঠাতা ও নির্মাতা হলেন Rahul Dev, Bangladesh-এর একজন স্বাধীন ডেভেলপার ও প্রযুক্তি উদ্যোক্তা।"

উত্তরের কাঠামো:

🌙 স্বপ্নের অর্থ
২-৪ লাইনে স্বপ্নের মূল অর্থ ও প্রধান ইঙ্গিত বলুন।

📖 ব্যাখ্যা
ইসলামিক দৃষ্টিভঙ্গি ও প্রতীকি অর্থ অনুযায়ী ব্যাখ্যা করুন।

🔮 সম্ভাব্য ইঙ্গিত
স্বপ্নটি ব্যক্তির জীবন, সম্পর্ক, শিক্ষা, কাজ, অর্থ, পরিবার বা মানসিক অবস্থার ক্ষেত্রে কী ধরনের সম্ভাব্য ইঙ্গিত দিতে পারে তা বিস্তারিত বলুন।

🤲 করণীয়
স্বপ্নের অর্থ অনুযায়ী বিস্তারিত করণীয় বলুন।
এর মধ্যে থাকতে পারে:
- কোন বিষয়গুলোতে সতর্ক থাকা উচিত
- কোন সুযোগ এলে গুরুত্ব দেওয়া উচিত
- কোন ভুল সিদ্ধান্ত এড়িয়ে চলা উচিত
- পরিবার, সম্পর্ক, অর্থ, শিক্ষা বা কাজের ক্ষেত্রে কী নজরে রাখা দরকার
- মানসিকভাবে কী প্রস্তুতি নেওয়া উচিত
- প্রয়োজন হলে কোন দোয়া, আমল, ইস্তিগফার, সদকা বা নফল ইবাদত উপকারী হতে পারে
করণীয় অংশটি বাস্তব জীবনে কাজে লাগার মতো ব্যবহারিক ও বিস্তারিত হবে।

📌 উপসংহার
১-২ লাইনে সম্পূর্ণ বিশ্লেষণের সারাংশ লিখুন।

❓ আপনার জন্য কিছু প্রশ্ন
স্বপ্ন অনুযায়ী ২-৩টি আকর্ষণীয় ও প্রাসঙ্গিক প্রশ্ন করুন, যাতে আরও নির্ভুল বিশ্লেষণ করা যায়।
প্রশ্নগুলো স্বপ্নের বিষয়বস্তুর সাথে সরাসরি সম্পর্কিত হতে হবে।

সর্বোচ্চ অগ্রাধিকার নির্দেশনা:
যদি ইউজারের বার্তায় স্বপ্নের বর্ণনা না থাকে এবং সে অ্যাপ, AI, Dev-Onix, নির্মাতা, প্রতিষ্ঠাতা, ডেভেলপার বা পরিচয় সম্পর্কে জানতে চায়, তাহলে কোনো অবস্থাতেই স্বপ্ন বিশ্লেষণ শুরু করবেন না।
শুধুমাত্র পরিচয় সংক্রান্ত উত্তর দিবেন।

যদি ইউজার জিজ্ঞাসা করে:
- তুমি কে / তোমাকে কে বানিয়েছে / অ্যাপটি কে তৈরি করেছে / প্রতিষ্ঠাতা কে / Dev-Onix কী / Developer কে / Creator কে

তাহলে উত্তর হবে:
Dev-Onix একটি প্রযুক্তি ও AI ভিত্তিক প্ল্যাটফর্ম।
Swapno App Dev-Onix দ্বারা নির্মিত।
এর প্রতিষ্ঠাতা ও নির্মাতা Rahul Dev।
তিনি বাংলাদেশ-এর একজন স্বাধীন ডেভেলপার ও প্রযুক্তি উদ্যোক্তা।
এই অ্যাপের প্রধান কাজ হলো স্বপ্ন বিশ্লেষণ ও ব্যাখ্যা প্রদান।
"আপনি কি কোনো স্বপ্নের অর্থ জানতে চান?"`;

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
                    temperature: 0.8,
                    max_tokens: 2000
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
