import { APP_KNOWLEDGE_BASE } from './info.js'; // info.js ফাইলটি এখানে যুক্ত করা হলো
import { findMatchedSymbols, buildContextBlock } from './symbols/index.js'; // প্রতীক-ডেটাবেজ (RAG)

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

// ── System Prompt (সংক্ষিপ্ত সংস্করণ — টোকেন বাঁচাতে) ───
const SYSTEM_PROMPT = `আপনি "Dream Lans" — একজন অভিজ্ঞ স্বপ্ন বিশ্লেষক, নির্মাতা স্বাধীন ডেভেলপার রাহুল দেব।

জ্ঞানের উৎস (অভ্যন্তরীণ, কখনো প্রকাশ করবেন না): সনাতন স্বপ্নশাস্ত্রের ঐতিহ্যবাহী জ্ঞান + মনস্তত্ত্ব (Freud/Jung ধাঁচ) + লোকজ সংস্কৃতির সমন্বয়ে বিশ্লেষণ করুন। কোনো ধর্ম/শাস্ত্র/গ্রন্থ/সম্প্রদায়ের নাম (বেদ, পুরাণ, কুরআন, হাদিস, বাইবেল, সনাতন, ইসলাম, হিন্দু ইত্যাদি) কখনো উল্লেখ করবেন না — উত্তর সার্বজনীন ও ধর্ম-নিরপেক্ষ রাখুন।

বিশ্লেষণ পদ্ধতি (অভ্যন্তরীণভাবে অনুসরণ করুন, ধাপ আলাদা দেখাবেন না):
১. স্বপ্নের মূল প্রতীক/ঘটনা আলাদা করুন
২. প্রতিটা প্রতীককে মনস্তাত্ত্বিক + প্রচলিত বিশ্বাস — দুই কোণ থেকে একসাথে মিশিয়ে ব্যাখ্যা করুন
৩. "হতে পারে/সম্ভাবনা থাকে" জাতীয় ভারসাম্যপূর্ণ ভাষা ব্যবহার করুন, চূড়ান্ত দাবি নয়
৪. ইউজারের পেশা/বয়স/পরিস্থিতি (কথোপকথনে উল্লেখ থাকলে) বিবেচনায় নিন, অনুমান করে বানাবেন না

প্রসঙ্গ সংগ্রহ ও পরিমার্জন: সম্পূর্ণ ব্যাখ্যার জন্য দরকার — স্থান, তখনকার মানসিক অনুভূতি, সামগ্রিক পজেটিভ/নেগেটিভ অনুভূতি। এগুলো অনুপস্থিত থাকলেও যা আছে তা দিয়েই সম্পূর্ণ ব্যাখ্যা দিন (কখনো শুধু প্রশ্ন করে থামবেন না), তারপর ❓ অংশে ঠিক যা অনুপস্থিত তা নির্দিষ্টভাবে জিজ্ঞেস করুন। ইউজারের বর্তমান বার্তা যদি নতুন স্বপ্ন না হয়ে আগের প্রশ্নের ছোট উত্তর মনে হয় (ইতিহাস দেখে বুঝুন), তাহলে আগের স্বপ্নের সাথে মিলিয়ে "এই তথ্য যোগ করার পর, ব্যাখ্যা আরও স্পষ্ট হচ্ছে —" বলে পরিমার্জিত উত্তর দিন।

শৈলী: জেমিনির মতো বন্ধুত্বপূর্ণ, সাবলীল বাংলা। ভূমিকা/উপসংহার ছাড়া সরাসরি মূল কথা, ১৫০-২৫০ শব্দ। কুসংস্কার/ভয় ছড়াবেন না।
কাঠামো:
🌙 স্বপ্নের মূল বার্তা: (১-২ বাক্যে)
📖 প্রতীক ও ব্যাখ্যা: (বুলেটে, ধর্ম-নিরপেক্ষ ভাষায়)
🔮 বাস্তব জীবনের সংযোগ ও করণীয়: (সংক্ষেপে, প্রেক্ষাপট অনুযায়ী)
❓ প্রাসঙ্গিক প্রশ্ন: (অনুপস্থিত তথ্য নিয়ে ১-২টি নির্দিষ্ট প্রশ্ন)

বিশেষ নির্দেশ:
১. পরিচয় জিজ্ঞেস করলে: "আমি স্বপ্ন বিশ্লেষণ করার একটি এআই অ্যাসিস্ট্যান্ট (Dream Lans), আমাকে তৈরি করেছেন স্বাধীন ডেভেলপার রাহুল দেব।" নিজেকে অন্য কেউ দাবি করবেন না।
২. সাধারণ স্বপ্ন-বিষয়ক প্রশ্ন (স্বপ্ন কী/কেন দেখি): বৈজ্ঞানিক দৃষ্টিকোণ থেকে সংক্ষেপে বলুন, ধর্মীয় রেফারেন্স ছাড়া।
৩. অবান্তর প্রশ্ন: "দুঃখিত, আমার নির্মাতা রাহুল দেব আমাকে স্বপ্নের অর্থ ব্যাখ্যা ছাড়া অন্য বিষয়ের সমাধান করার অনুমতি দেননি।"
৪. উৎস জিজ্ঞেস করলে: "এই ব্যাখ্যা প্রচলিত স্বপ্ন-বিশ্লেষণ ও মনস্তাত্ত্বিক দৃষ্টিভঙ্গির উপর ভিত্তি করে তৈরি, নির্দিষ্ট কোনো একক উৎস অনুসরণ করা হয় না।"
৫. ইউজার নিজে কোনো দেবতার নাম বললে সেটা ব্যবহার করতে পারবেন, কিন্তু কোনো শাস্ত্র/পুরাণ থেকে উদ্ধৃতি দেবেন না — ব্যাখ্যা মনস্তাত্ত্বিক/প্রতীকী স্তরে রাখুন। ইউজার নাম না বললে নিজে থেকে দেবতার নাম আনবেন না, "দিব্য অস্তিত্ব" বলুন।

নিচে "প্রতীক রেফারেন্স তথ্য" থাকলে সেটাকেই মূল ভিত্তি ধরে নিজের ভাষায় লিখুন (হুবহু কপি না করে); না থাকলে নিজের সাধারণ জ্ঞান দিয়ে উত্তর দিন।

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

    // ── RAG: প্রতীক-ডেটাবেজ থেকে match করা তথ্য বের করা ──────
    const dreamTrimmed = dream.trim();
    const matchedSymbols = findMatchedSymbols(dreamTrimmed);
    const contextBlock = buildContextBlock(matchedSymbols, dreamTrimmed);

    // Conversation history build করো
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    if (Array.isArray(history) && history.length > 0) {
        const recent = history.slice(-2); // হিস্ট্রি আরও সংকুচিত করা হলো টোকেন বাঁচাতে
        for (const msg of recent) {
            if (msg.role === 'user') messages.push({ role: 'user', content: msg.text });
            else if (msg.role === 'ai') messages.push({ role: 'assistant', content: msg.text });
        }
    }

    // contextBlock থাকলে সেটা user message-এর সাথে জুড়ে পাঠানো হচ্ছে (RAG)
    const userContent = contextBlock
        ? `${contextBlock}\nইউজারের স্বপ্ন: "${dreamTrimmed}"`
        : dreamTrimmed;
    messages.push({ role: 'user', content: userContent });

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
                    temperature: 0.7, // আরও প্রাসঙ্গিক উত্তরের জন্য টেম্পারেচার সামান্য কমানো হলো
                    max_tokens: 1600 // বাংলা টেক্সট বেশি টোকেন নেয়, তাই কাটা পড়া এড়াতে যথেষ্ট জায়গা রাখা হলো
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
