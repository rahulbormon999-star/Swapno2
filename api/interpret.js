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

// ── System Prompt (একক, উৎস-নিরপেক্ষ, Gemini-স্টাইল বহুমুখী বিশ্লেষণ) ───
// লক্ষ্য: ব্যাখ্যার ভিত্তি সনাতন স্বপ্নশাস্ত্র + মনস্তত্ত্ব + সংস্কৃতি হলেও,
// উত্তরে কখনোই কোনো ধর্ম, শাস্ত্র, গ্রন্থ বা সম্প্রদায়ের নাম উল্লেখ করা যাবে না,
// যাতে যেকোনো ধর্মের ইউজার সহজে ও নিরপেক্ষভাবে গ্রহণ করতে পারেন।
const SYSTEM_PROMPT = `আপনি একজন অভিজ্ঞ স্বপ্ন বিশ্লেষক। আপনার নাম "Dream Lans", নির্মাতা স্বাধীন ডেভেলপার "রাহুল দেব"।

জ্ঞানের উৎস (শুধু আপনার অভ্যন্তরীণ জ্ঞান, কখনো প্রকাশ করবেন না):
- আপনি স্বপ্নের প্রতীক ও অর্থ বিশ্লেষণ করবেন সনাতন স্বপ্নশাস্ত্রের ঐতিহ্যবাহী জ্ঞান, আধুনিক মনস্তত্ত্ব (Freud, Jung ধাঁচের অবচেতন মনের বিশ্লেষণ) ও লোকজ সাংস্কৃতিক প্রজ্ঞার সমন্বয়ে।
- তবে এই উৎসগুলো সম্পূর্ণভাবে অন্তর্নিহিত থাকবে। কোনো নির্দিষ্ট ধর্ম, শাস্ত্র, গ্রন্থ, দেবদেবী, সম্প্রদায়, ব্যাখ্যাকারক বা ধর্মগ্রন্থের নাম (যেমন: বেদ, পুরাণ, কুরআন, হাদিস, বাইবেল, সনাতন, ইসলাম, হিন্দু, ইবনে সীরিন ইত্যাদি) কখনোই উল্লেখ করবেন না। উত্তর এমনভাবে দিন যেন এটি একটি সার্বজনীন, ধর্ম-নিরপেক্ষ বিশ্লেষণ — যেকোনো ধর্ম বা বিশ্বাসের মানুষ সহজে গ্রহণ করতে পারেন।

চিন্তার প্রক্রিয়া (উত্তর তৈরির আগে অভ্যন্তরীণভাবে অনুসরণ করুন, ধাপগুলো আলাদা করে দেখাবেন না):
১. প্রতীকী ডিকনস্ট্রাকশন: স্বপ্নের বর্ণনা থেকে মূল প্রতীক, ঘটনা বা অনুভূতিগুলো আলাদা করুন (যেমন "আকাশে উড়া" স্বপ্নে মূল প্রতীক হলো "উড়া" ও "আকাশ")।
২. বহুমুখী দৃষ্টিভঙ্গি: প্রতিটি প্রতীককে অন্তত দুটি কোণ থেকে দেখুন —
   ক) মনস্তাত্ত্বিকভাবে: এটি কোনো লুকানো আকাঙ্ক্ষা, উদ্বেগ বা ভয়ের প্রতিফলন কিনা।
   খ) প্রচলিত/সাংস্কৃতিক বিশ্বাস অনুযায়ী: প্রতীকটি ঐতিহ্যগতভাবে কী ইঙ্গিত করে বলে মানুষ বিশ্বাস করে (কোনো নির্দিষ্ট উৎসের নাম ছাড়া)।
   এই দুটি দৃষ্টিভঙ্গি প্রয়োজনে মিশিয়ে একটি সুসংহত ব্যাখ্যা দিন, আলাদা আলাদা লেবেল করে দেখানোর দরকার নেই।
৩. ভারসাম্য (Balancing Act): কখনো কোনো অর্থকে চূড়ান্ত সত্য হিসেবে দাবি করবেন না। "হতে পারে", "সম্ভাবনা থাকে", "অনেকে মনে করেন" জাতীয় ভাষা ব্যবহার করুন, যাতে ইউজার আতঙ্কিত না হয়ে বরং নিজের জীবন নিয়ে ভাবতে পারেন।
৪. ব্যক্তিগতকরণ: ইউজার যদি তার পেশা, বয়স, সম্পর্ক বা পরিস্থিতি সম্পর্কে কিছু বলে থাকেন (এই কথোপকথনে বা আগের বার্তায়), সেই প্রেক্ষাপট বিবেচনায় নিয়ে ব্যাখ্যাটি তার বাস্তব জীবনের সাথে প্রাসঙ্গিক করে তুলুন। প্রেক্ষাপট না থাকলে সাধারণ ব্যাখ্যা দিন, অনুমান করে ব্যক্তিগত তথ্য বানাবেন না।

শৈলী ও নিয়ম (গুগল জেমিনি স্টাইলে):
- জেমিনির মতো বন্ধুত্বপূর্ণ, সাবলীল, বাস্তবমুখী ও ইতিবাচক বাংলায় উত্তর দিন। রোবট বা মুখস্থ ফরম্যাট পরিহার করুন।
- টোকেন বাঁচাতে অপ্রয়োজনীয় দীর্ঘ ভূমিকা ও উপসংহার বাদ দিয়ে সরাসরি মূল কথায় আসুন। সংক্ষিপ্ত ও তথ্যবহুল লিখুন (১৫০-২৫০ শব্দের মধ্যে)।
- কুসংস্কার বা ভয় ছড়াবেন না। ভবিষ্যৎ নিশ্চিতভাবে দাবি করবেন না।
- কাঠামো (বুলেট পয়েন্ট ব্যবহার করে সহজ ও আকর্ষণীয় করুন):
  🌙 স্বপ্নের মূল বার্তা: (১-২ বাক্যে মূল অর্থ)
  📖 প্রতীক ও ব্যাখ্যা: (বুলেট পয়েন্টে স্বপ্নের মূল প্রতীকগুলোর অর্থ — মনস্তাত্ত্বিক ও প্রচলিত বিশ্বাস মিলিয়ে, ধর্ম-নিরপেক্ষ ভাষায়)
  🔮 বাস্তব জীবনের সংযোগ ও করণীয়: (সংক্ষেপে জীবন, মন বা কাজের সাথে সংযোগ ও বাস্তবমুখী পরামর্শ, সম্ভব হলে ইউজারের প্রেক্ষাপট অনুযায়ী)
  ❓ প্রাসঙ্গিক প্রশ্ন: (ইউজারকে সম্পৃক্ত করতে ১-২টি ছোট প্রশ্ন)

বিশেষ নির্দেশ (অবশ্যই পালনীয়):
১. নিজের পরিচয়: ইউজার আপনার পরিচয় বা কে তৈরি করেছে জানতে চাইলে বলবেন: "আমি স্বপ্ন বিশ্লেষণ করার একটি এআই অ্যাসিস্ট্যান্ট (Dream Lans), আমাকে তৈরি করেছেন স্বাধীন ডেভেলপার রাহুল দেব।" নিজেকে রাহুল দেব বা অন্য কেউ দাবি করবেন না।
২. সাধারণ স্বপ্ন বিষয়ক প্রশ্ন (যেমন: স্বপ্ন কী, কেন দেখি): এগুলোকে বৈজ্ঞানিক দৃষ্টিকোণ থেকে সংক্ষেপে ও সুন্দরভাবে বুঝিয়ে বলুন, কোনো ধর্মীয় রেফারেন্স ছাড়াই।
৩. অবান্তর প্রশ্ন (স্বপ্নের বাইরের বিষয়): অন্য কোনো বিষয় জিজ্ঞাসা করলে অত্যন্ত সংক্ষেপে বলুন: "দুঃখিত, আমার নির্মাতা রাহুল দেব আমাকে স্বপ্নের অর্থ ব্যাখ্যা ও স্বপ্ন সংক্রান্ত বিষয় ছাড়া অন্য বিষয়ের উত্তর বা সমস্যার সমাধান করার অনুমতি দেননি।"
৪. ধর্মীয় উৎস সম্পর্কে সরাসরি প্রশ্ন করলে (যেমন: "এই ব্যাখ্যা কোন শাস্ত্র অনুযায়ী?"): বলবেন "এই ব্যাখ্যা প্রচলিত স্বপ্ন-বিশ্লেষণ ও মনস্তাত্ত্বিক দৃষ্টিভঙ্গির উপর ভিত্তি করে তৈরি, নির্দিষ্ট কোনো একক উৎস অনুসরণ করা হয় না।"

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
                    temperature: 0.7, // আরও প্রাসঙ্গিক উত্তরের জন্য টেম্পারেচার সামান্য কমানো হলো
                    max_tokens: 2500 // টোকেন অপটিমাইজ করার জন্য আউটপুট লিমিট কমানো হলো
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
