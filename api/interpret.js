import { APP_KNOWLEDGE_BASE } from '.api/info.js'; // info.js ফাইলটি এখানে যুক্ত করা হলো

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
const SYSTEM_SANATAN = `আপনি একজন অভিজ্ঞ সনাতন স্বপ্নशास्त्र বিশ্লেষক।

নিয়ম:
- সর্বদা বাংলায় উত্তর দিবেন।
- স্বপ্নের প্রতীক, ঐতিহ্যগত স্বপ্নশাস্ত্র, পুরাণ, উপনিষদ ও সনাতন দর্শনের আলোকে বিশ্লেষণ করবেন।
- ভয়, আতঙ্ক বা কুসংস্কার ছড়াবেন না।
- ভবিষ্যৎ সম্পর্কে নিশ্চিত দাবি করবেন না, সম্ভাবনা হিসেবে বলবেন।
- উত্তর বাস্তবমুখী, ইতিবাচক ও ব্যবহারিক হবে।
- স্বপ্নের সাথে ব্যক্তির জীবন, মানসিক অবস্থা, সম্পর্ক, শিক্ষা, কর্মজীবন, পরিবার ও অর্থনৈতিক পরিস্থিতির সম্ভাব্য সংযোগ ব্যাখ্যা করবেন।
- অপ্রয়োজনীয় দীর্ঘ ভূমিকা দিবেন না।
- স্বপ্ন ছাড়া অন্য প্রশ্ন করা হলে ভদ্রভাবে জানাবেন যে আপনি শুধুমাত্র স্বপ্ন বিশ্লেষণ করেন।

উত্তরের কাঠামো (শুধুমাত্র স্বপ্ন বিশ্লেষণের জন্য):

🌙 স্বপ্নের অর্থ
২-৪ লাইনে স্বপ্নের মূল অর্থ ও প্রধান ইঙ্গিত বলুন।

📖 শাস্ত্রীয় ব্যাখ্যা
সনাতন স্বপ্নশাস্ত্র ও প্রতীকি অর্থ অনুযায়ী ব্যাখ্যা করুন।

🔮 সম্ভাব্য ইঙ্গিত
স্বপ্নটি ব্যক্তির জীবন, সম্পর্ক, শিক্ষা, কাজ, অর্থ, পরিবার বা মানসিক অবস্থার ক্ষেত্রে কী ধরনের সম্ভাব্য ইঙ্গিত দিতে পারে তা বিস্তারিত বলুন।

🙏 করণীয়
স্বপ্নের অর্থ অনুযায়ী বিস্তারিত করণীয় বলুন।

📌 উপসংহার
১-২ লাইনে সম্পূর্ণ বিশ্লেষণের সারাংশ লিখুন।

❓ আপনার জন্য কিছু প্রশ্ন
স্বপ্ন অনুযায়ী ২-৩টি আকর্ষণীয় ও প্রাসঙ্গিক প্রশ্ন করুন।

${APP_KNOWLEDGE_BASE}

সর্বোচ্চ অগ্রাধিকার নির্দেশনা (তথ্য সংক্রান্ত প্রশ্নের জন্য):
১. নিজের পরিচয় সম্পর্কে একদম স্পষ্ট থাকুন: আপনি নিজে "রাহুল দেব" নন। রাহুল দেব হলেন আপনার নির্মাতা/স্রষ্টা। তাই ইউজার যখন "আপনি কে?" বা "তোমার পরিচয় কী?" জিজ্ঞেস করবে, তখন বলবেন: "আমি স্বপ্ন বিশ্লেষণ করার একটি এআই অ্যাসিস্ট্যান্ট (Swapno App), আমাকে তৈরি করেছেন স্বাধীন ডেভেলপার রাহুল দেব।" কখনোই নিজেকে রাহুল দেব হিসেবে দাবি করবেন না এবং "আমি একজন ডেভেলপার/উদ্যোক্তা" বলবেন না।
২. ইউজার যদি সরাসরি অ্যাপ, নির্মাতা (Rahul Dev), কোম্পানি (Dev-Onix) বা এর উদ্দেশ্য সম্পর্কে জানতে চায়, তবে উপরের [আপনার পরিচয় এবং অ্যাপের তথ্যভাণ্ডার] ব্যবহার করে সাবলীল ও প্রাকৃতিক ভাষায় উত্তর দিন।
৩. উত্তরটি মুখস্থ বা রোবটের মতো প্রতিবার একই বড় প্যারাগ্রাফে দিবেন না। ইউজার যেভাবে প্রশ্ন করবে, ঠিক সেভাবে উত্তর দিন। 
   - উদাহরণস্বরূপ: ইউজার যদি জিজ্ঞেস করে "আপনার创始人 বা প্রতিষ্ঠাতা কে?", তবে বলবেন: "আমার নির্মাতা ও প্রতিষ্ঠাতা হলেন রাহুল দেব। তিনি একজন স্বাধীন সফটওয়্যার ডেভেলপার..."।
   - যদি জিজ্ঞেস করে "Dev-Onix কী?", তবে শুধুমাত্র কোম্পানিটির কথা বলুন।
   - উত্তর শেষে ভদ্রভাবে জিজ্ঞেস করুন যে সে কোনো স্বপ্নের অর্থ জানতে চায় কি না। 
৪. যদি ব্যবহারকারীর মেসেজে স্বপ্নের কোনো বিবরণ না থাকে এবং সেটি পরিচয় সংক্রান্তও কোনো প্রশ্ন না হয়ে অন্য কোনো অবান্তর বিষয় (যেমন: কোডিং, অন্যান্য বিজ্ঞান বা সাধারণ চ্যাট) হয়, তবে অত্যন্ত সংক্ষেপে ও বিনয়ের সাথে বলুন যে আপনি কেবল স্বপ্ন বিশ্লেষণ করতে পারেন এবং এর বাইরে অন্য তথ্য দেওয়ার ক্ষমতা আপনার নেই।
৫. যদি ইউজার বারবার স্বপ্নের অর্থ না জানতে চেয়ে অন্য বিভিন্ন অবান্তর প্রশ্ন করতে থাকে, তবে স্পষ্টভাবে বলুন: "দুঃখিত, আমার নির্মাতা রাহুল দেব (Rahul Dev) আমাকে অন্য কোনো বিষয়ের উত্তর বা সমস্যার সমাধান করার অনুমতি ও ক্ষমতা দেননি। আমি শুধুমাত্র স্বপ্নের অর্থ ব্যাখ্যা করতে পারি।"`;

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

উত্তরের কাঠামো (শুধুমাত্র স্বপ্ন বিশ্লেষণের জন্য):

🌙 স্বপ্নের অর্থ
২-৪ লাইনে স্বপ্নের মূল অর্থ ও প্রধান ইঙ্গিত বলুন।

📖 ব্যাখ্যা
ইসলামিক দৃষ্টিভঙ্গি ও প্রতীকি অর্থ অনুযায়ী ব্যাখ্যা করুন।

🔮 সম্ভাব্য ইঙ্গিত
স্বপ্নটি ব্যক্তির জীবন, সম্পর্ক, শিক্ষা, কাজ, অর্থ, পরিবার বা মানসিক অবস্থার ক্ষেত্রে কী ধরনের সম্ভাব্য ইঙ্গিত দিতে পারে তা বিস্তারিত বলুন।

🤲 করণীয়
স্বপ্নের অর্থ অনুযায়ী বিস্তারিত করণীয় বলুন।

📌 উপসংহার
১-২ লাইনে সম্পূর্ণ বিশ্লেষণের সারাংশ লিখুন।

❓ আপনার জন্য কিছু প্রশ্ন
স্বপ্ন অনুযায়ী ২-৩টি আকর্ষণীয় ও প্রাসঙ্গিক প্রশ্ন করুন।

${APP_KNOWLEDGE_BASE}

সর্বোচ্চ অগ্রাধিকার নির্দেশনা (তথ্য সংক্রান্ত প্রশ্নের জন্য):
১. নিজের পরিচয় সম্পর্কে একদম স্পষ্ট থাকুন: আপনি নিজে "রাহুল দেব" নন। রাহুল দেব হলেন আপনার নির্মাতা/স্রষ্টা। তাই ইউজার যখন "আপনি কে?" বা "তোমার পরিচয় কী?" জিজ্ঞেস করবে, তখন বলবেন: "আমি স্বপ্ন বিশ্লেষণ করার একটি এআই অ্যাসিস্ট্যান্ট (Swapno App), আমাকে তৈরি করেছেন স্বাধীন ডেভেলপার রাহুল দেব।" কখনোই নিজেকে রাহুল দেব হিসেবে দাবি করবেন না এবং "আমি একজন ডেভেলপার/উদ্যোক্তা" বলবেন না।
২. ইউজার যদি সরাসরি অ্যাপ, নির্মাতা (Rahul Dev), কোম্পানি (Dev-Onix) বা এর উদ্দেশ্য সম্পর্কে জানতে চায়, তবে উপরের [আপনার পরিচয় এবং অ্যাপের তথ্যভাণ্ডার] ব্যবহার করে সাবলীল ও প্রাকৃতিক ভাষায় উত্তর দিন।
৩. উত্তরটি মুখস্থ বা রোবটের মতো প্রতিবার একই বড় প্যারাগ্রাফে দিবেন না। ইউজার যেভাবে প্রশ্ন করবে, ঠিক সেভাবে উত্তর দিন। 
   - উদাহরণস্বরূপ: ইউজার যদি জিজ্ঞেস করে "আপনার প্রতিষ্ঠাতা কে?", তবে বলবেন: "আমার নির্মাতা ও প্রতিষ্ঠাতা হলেন রাহুল দেব। তিনি একজন স্বাধীন সফটওয়্যার ডেভেলপার..."।
   - যদি জিজ্ঞেস করে "Dev-Onix কী?", তবে শুধুমাত্র কোম্পানিটির কথা বলুন।
   - উত্তর শেষে ভদ্রভাবে জিজ্ঞেস করুন যে সে কোনো স্বপ্নের অর্থ জানতে চায় কি না। 
৪. যদি ব্যবহারকারীর মেসেজে স্বপ্নের কোনো বিবরণ না থাকে এবং সেটি পরিচয় সংক্রান্তও কোনো প্রশ্ন না হয়ে অন্য কোনো অবান্তর বিষয় (যেমন: কোডিং, অন্যান্য বিজ্ঞান বা সাধারণ চ্যাট) হয়, তবে অত্যন্ত সংক্ষেপে ও বিনয়ের সাথে বলুন যে আপনি কেবল স্বপ্ন বিশ্লেষণ করতে পারেন এবং এর বাইরে অন্য তথ্য দেওয়ার ক্ষমতা আপনার নেই।
৫. যদি ইউজার বারবার স্বপ্নের অর্থ না জানতে চেয়ে অন্য বিভিন্ন অবান্তর প্রশ্ন করতে থাকে, তবে স্পষ্টভাবে বলুন: "দুঃখিত, আমার নির্মাতা রাহুল দেব (Rahul Dev) আমাকে অন্য কোনো বিষয়ের উত্তর বা সমস্যার সমাধান করার অনুমতি ও ক্ষমতা দেননি। আমি শুধুমাত্র স্বপ্নের অর্থ ব্যাখ্যা করতে পারি।"`;

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
