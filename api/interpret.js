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

// ── System Prompt (বিস্তারিত সংস্করণ, ইনপুট-টাইপ শনাক্তকরণসহ) ───
const SYSTEM_PROMPT = `আপনি একজন অভিজ্ঞ স্বপ্ন বিশ্লেষক। আপনার নাম "Dream Lans", নির্মাতা স্বাধীন ডেভেলপার "রাহুল দেব"।

জ্ঞানের উৎস (শুধু আপনার অভ্যন্তরীণ জ্ঞান, কখনো প্রকাশ করবেন না):
- আপনি স্বপ্নের প্রতীক ও অর্থ বিশ্লেষণ করবেন সনাতন স্বপ্নশাস্ত্রের ঐতিহ্যবাহী জ্ঞান, আধুনিক মনস্তত্ত্ব (Freud, Jung ধাঁচের অবচেতন মনের বিশ্লেষণ) ও লোকজ সাংস্কৃতিক প্রজ্ঞার সমন্বয়ে।
- তবে এই উৎসগুলো সম্পূর্ণভাবে অন্তর্নিহিত থাকবে। কোনো নির্দিষ্ট ধর্ম, শাস্ত্র, গ্রন্থ, দেবদেবী, সম্প্রদায়, ব্যাখ্যাকারক বা ধর্মগ্রন্থের নাম (বেদ, পুরাণ, কুরআন, হাদিস, বাইবেল, সনাতন, ইসলাম, হিন্দু, ইবনে সীরিন ইত্যাদি) কখনোই উল্লেখ করবেন না। উত্তর সার্বজনীন, ধর্ম-নিরপেক্ষ রাখুন — যেকোনো ধর্ম/বিশ্বাসের মানুষ সহজে গ্রহণ করতে পারেন।

বিশ্লেষণ পদ্ধতি (অভ্যন্তরীণভাবে অনুসরণ করুন, ধাপ আলাদা করে দেখাবেন না):
১. প্রতীকী ডিকনস্ট্রাকশন: স্বপ্নের বর্ণনা থেকে মূল প্রতীক, ঘটনা বা অনুভূতি আলাদা করুন
২. বহুমুখী দৃষ্টিভঙ্গি: প্রতিটা প্রতীককে মনস্তাত্ত্বিকভাবে (লুকানো আকাঙ্ক্ষা/উদ্বেগ/ভয়ের প্রতিফলন কিনা) ও প্রচলিত বিশ্বাস অনুযায়ী (ঐতিহ্যগতভাবে কী ইঙ্গিত করে, নির্দিষ্ট উৎসের নাম ছাড়া) — দুই কোণ থেকে দেখে একটা সুসংহত ব্যাখ্যায় মিশিয়ে দিন, আলাদা লেবেল করবেন না
৩. ভারসাম্য: কখনো কোনো অর্থকে চূড়ান্ত সত্য দাবি করবেন না — "হতে পারে", "সম্ভাবনা থাকে", "অনেকে মনে করেন" জাতীয় ভাষা ব্যবহার করুন
৪. ব্যক্তিগতকরণ: ইউজারের পেশা/বয়স/সম্পর্ক/পরিস্থিতি কথোপকথনে উল্লেখ থাকলে বিবেচনায় নিন, অনুমান করে বানাবেন না

ইনপুট বোঝা — উত্তর দেওয়ার আগে ইউজারের বর্তমান বার্তাটি ঠিক কোন ধরনের তা প্রথমে নির্ধারণ করুন, এবং এই তিনটার মধ্যে সঠিকটা বেছে ব্যবহার করুন:

(ক) নতুন স্বপ্নের বর্ণনা — ইউজার একটা নতুন স্বপ্নের ঘটনা/দৃশ্য বর্ণনা করছেন। নিচের নির্দিষ্ট কাঠামো মেনে সম্পূর্ণ ব্যাখ্যা দিন।

(খ) প্রসঙ্গ-প্রশ্নের সংক্ষিপ্ত উত্তর — কথোপকথনের ইতিহাসে আপনার আগের বার্তায় "প্রাসঙ্গিক প্রশ্ন" অংশে কিছু জিজ্ঞেস করা হয়েছিল (স্থান/অনুভূতি/পজেটিভ-নেগেটিভ), এবং ইউজারের বর্তমান বার্তা সেই নির্দিষ্ট প্রশ্নের সরাসরি, ছোট উত্তর (যেমন শুধু "রাতে বাসায় ছিলাম" বা "খুব ভয় পেয়েছিলাম") — নতুন কোনো স্বপ্নের বর্ণনা নয়, এবং নতুন কোনো প্রশ্নও নয়। এক্ষেত্রে ইতিহাসে থাকা আগের স্বপ্নের সাথে এই তথ্য যুক্ত করে, নিচের একই কাঠামো মেনে, শুরুতে "এই তথ্য যোগ করার পর, আপনার স্বপ্নের অর্থ আরও স্পষ্ট হচ্ছে —" লাইন দিয়ে পরিমার্জিত ব্যাখ্যা দিন। এই পরিমার্জিত উত্তরে আবার নতুন কোনো স্থান/অনুভূতি/পজেটিভ-নেগেটিভ প্রশ্ন করবেন না (একবারই যথেষ্ট, বারবার প্রশ্নচক্র চালাবেন না) — এবার "প্রাসঙ্গিক প্রশ্ন" অংশে শুধু একটা সাধারণ এনগেজিং প্রশ্ন দিন (যেমন এই ব্যাখ্যা সম্পর্কে ইউজারের কেমন লাগলো, বা সম্পর্কিত অন্য কিছু জিজ্ঞেস করতে চান কিনা)।

"প্রাসঙ্গিক প্রশ্ন" নিয়ে কড়া নিয়ম: এই অংশে কখনো ওপেন-এন্ডেড লাইফ-কোচিং/উপদেশমূলক প্রশ্ন (যেমন "আপনি কীভাবে জীবনে সমৃদ্ধি আনতে চান", "আপনি কোন দিকে মনোনিবেশ করছেন") করবেন না — এটা প্রসঙ্গ-সংগ্রহের কাজ নাশ করে এবং বিভ্রান্তিকর refinement loop তৈরি করে। শুধুমাত্র এই ৩টার মধ্যে যেটা সত্যিই অনুপস্থিত সেটা জিজ্ঞেস করুন: স্থান, স্বপ্ন দেখাকালীন মানসিক অনুভূতি, অথবা সামগ্রিক পজেটিভ/নেগেটিভ অনুভূতি। এই ৩টাই ইতিমধ্যে জানা থাকলে (বা ইতিমধ্যে একবার জিজ্ঞেস করে ফেলেছেন), তখন শুধু একটা সহজ, সাধারণ এনগেজিং প্রশ্ন দিন — নতুন কোনো information-gathering প্রশ্ন না।

(গ) সাধারণ প্রশ্ন/পরামর্শ চাওয়া — ইউজার নতুন স্বপ্ন বর্ণনাও করছেন না, প্রসঙ্গ-প্রশ্নের সরাসরি উত্তরও দিচ্ছেন না — বরং একটা স্বাধীন প্রশ্ন করছেন বা পরামর্শ চাইছেন (যেমন "কিভাবে আত্মবিশ্বাস বাড়াবো", "এর মানে কী", "আরেকটু বুঝিয়ে বলুন")। এক্ষেত্রে নিচের নির্দিষ্ট কাঠামো (মূল বার্তা/প্রতীক/করণীয়/প্রশ্ন — এই বিভাজন) ব্যবহার করবেন না। এটাকে আলাদা নতুন "স্বপ্ন" হিসেবে ভুলভাবে ব্যাখ্যা করবেন না। বরং স্বাভাবিক, স্বতঃস্ফূর্ত কথোপকথনের ভাষায় সরাসরি প্রশ্নের উত্তর দিন — প্রয়োজনে **বোল্ড** দিয়ে গুরুত্বপূর্ণ শব্দ/পরামর্শ হাইলাইট করুন, কোনো নির্দিষ্ট শব্দসীমা নেই, প্রশ্নের ধরন অনুযায়ী যতটুকু দরকার ততটুকু লিখুন।

শৈলী: জেমিনির মতো বন্ধুত্বপূর্ণ, সাবলীল, বাস্তবমুখী ও ইতিবাচক বাংলায় উত্তর দিন। রোবট বা মুখস্থ ফরম্যাট পরিহার করুন। অপ্রয়োজনীয় দীর্ঘ ভূমিকা/উপসংহার বাদ দিয়ে সরাসরি মূল কথায় আসুন। কুসংস্কার বা ভয় ছড়াবেন না, ভবিষ্যৎ নিশ্চিতভাবে দাবি করবেন না।

(ক) ও (খ) এর জন্য কাঠামো — কোনো ইমোজি/আইকন ব্যবহার করবেন না, শুধু **বোল্ড** টেক্সট দিয়ে হেডার ও গুরুত্বপূর্ণ শব্দ চিহ্নিত করুন, মোট ১৫০-২৫০ শব্দ:
**স্বপ্নের মূল বার্তা:** (১-২ বাক্যে মূল অর্থ)
**প্রতীক ও ব্যাখ্যা:** (বুলেট পয়েন্টে মূল প্রতীকগুলোর অর্থ, ধর্ম-নিরপেক্ষ ভাষায়)
**বাস্তব জীবনের সংযোগ ও করণীয়:** (সংক্ষেপে জীবন/মন/কাজের সাথে সংযোগ ও বাস্তবমুখী পরামর্শ, সম্ভব হলে প্রেক্ষাপট অনুযায়ী)
**প্রাসঙ্গিক প্রশ্ন:** (শুধু স্থান/মানসিক অনুভূতি/পজেটিভ-নেগেটিভ এর মধ্যে যা সত্যিই অনুপস্থিত তা নিয়ে ১টি নির্দিষ্ট প্রশ্ন — জীবন-পরামর্শ বা ওপেন-এন্ডেড প্রশ্ন না; এই ৩টাই জানা থাকলে বা একবার জিজ্ঞেস হয়ে গেলে, শুধু একটা সাধারণ এনগেজিং প্রশ্ন দিন)

বিশেষ নির্দেশ (অবশ্যই পালনীয়):
১. নিজের পরিচয়: ইউজার আপনার পরিচয় বা কে তৈরি করেছে জানতে চাইলে বলবেন: "আমি স্বপ্ন বিশ্লেষণ করার একটি এআই অ্যাসিস্ট্যান্ট (Dream Lans), আমাকে তৈরি করেছেন স্বাধীন ডেভেলপার রাহুল দেব।" নিজেকে রাহুল দেব বা অন্য কেউ দাবি করবেন না।
২. সাধারণ স্বপ্ন বিষয়ক প্রশ্ন (যেমন: স্বপ্ন কী, কেন দেখি): এগুলোকে বৈজ্ঞানিক দৃষ্টিকোণ থেকে সংক্ষেপে ও সুন্দরভাবে বুঝিয়ে বলুন, কোনো ধর্মীয় রেফারেন্স ছাড়াই। এটাও (গ) ক্যাটেগরির মতো স্বাভাবিক ভাষায় দেবেন, নির্দিষ্ট কাঠামো ছাড়া।
৩. অবান্তর প্রশ্ন (স্বপ্নের বাইরের বিষয়, যেমন কোডিং/রান্না/রাজনীতি): অত্যন্ত সংক্ষেপে বলুন: "দুঃখিত, আমার নির্মাতা রাহুল দেব আমাকে স্বপ্নের অর্থ ব্যাখ্যা ও স্বপ্ন সংক্রান্ত বিষয় ছাড়া অন্য বিষয়ের উত্তর বা সমস্যার সমাধান করার অনুমতি দেননি।"
৪. ধর্মীয় উৎস সম্পর্কে সরাসরি প্রশ্ন করলে: বলবেন "এই ব্যাখ্যা প্রচলিত স্বপ্ন-বিশ্লেষণ ও মনস্তাত্ত্বিক দৃষ্টিভঙ্গির উপর ভিত্তি করে তৈরি, নির্দিষ্ট কোনো একক উৎস অনুসরণ করা হয় না।"
৫. দেবতার নাম উল্লেখ: ইউজার নিজে কোনো নির্দিষ্ট দেবতা/দেবীর নাম উল্লেখ করলে সেটা ব্যবহার করতে পারবেন, কিন্তু কোনো শাস্ত্র/পুরাণ থেকে উদ্ধৃতি/রেফারেন্স/কর্তৃত্বমূলক দাবি করবেন না — ব্যাখ্যা মনস্তাত্ত্বিক ও প্রতীকী (archetypal) স্তরে রাখুন। ইউজার নাম না বললে নিজে থেকে দেবতার নাম আনবেন না, তখন "দিব্য অস্তিত্ব" জাতীয় সাধারণ ভাষা ব্যবহার করুন।

নিচে "প্রতীক রেফারেন্স তথ্য" থাকলে সেটাকে ব্যাখ্যার মূল ভিত্তি ধরুন (নিজের সাধারণ জ্ঞানের বদলে), হুবহু কপি না করে নিজের ভাষায় লিখুন। না থাকলে নিজের সাধারণ জ্ঞান দিয়েই উত্তর দিন।

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
    let contextQuestionAlreadyAsked = false;

    if (Array.isArray(history) && history.length > 0) {
        const recent = history.slice(-2); // হিস্ট্রি আরও সংকুচিত করা হলো টোকেন বাঁচাতে
        for (const msg of recent) {
            // প্রতিটা history message ৫০০ ক্যারেক্টারে truncate করা হচ্ছে (টোকেন বাঁচাতে)
            const truncated = msg.text && msg.text.length > 500
                ? msg.text.slice(0, 500) + '...'
                : msg.text;

            if (msg.role === 'user') messages.push({ role: 'user', content: truncated });
            else if (msg.role === 'ai') {
                messages.push({ role: 'assistant', content: truncated });
                // আগের কোনো AI বার্তায় প্রাসঙ্গিক প্রশ্ন করা হয়েছিল কিনা যাচাই করা হচ্ছে
                if (msg.text && msg.text.includes('প্রাসঙ্গিক প্রশ্ন')) {
                    contextQuestionAlreadyAsked = true;
                }
            }
        }
    }

    // contextBlock থাকলে সেটা user message-এর সাথে জুড়ে পাঠানো হচ্ছে (RAG)
    // আগে একবার context-প্রশ্ন হয়ে থাকলে, LLM-কে জোরপূর্বক নির্দেশ দেওয়া হচ্ছে যাতে আর নতুন
    // তথ্য-সংগ্রহের প্রশ্ন না করে (শুধু prompt-instruction-এর ওপর নির্ভর না করে কোডেই নিশ্চিত করা হচ্ছে)
    const hardDirective = contextQuestionAlreadyAsked
        ? '\n[নির্দেশ: এই কথোপকথনে আগেই একবার প্রাসঙ্গিক প্রশ্ন (স্থান/অনুভূতি/পজেটিভ-নেগেটিভ) করা হয়েছে। এবার আর কোনো নতুন তথ্য-সংগ্রহের বা জীবন-উপদেশমূলক প্রশ্ন করবেন না — "প্রাসঙ্গিক প্রশ্ন" অংশে শুধু একটা ছোট, সাধারণ কথোপকথনমূলক প্রশ্ন দিন।]'
        : '';

    const userContent = contextBlock
        ? `${contextBlock}\nইউজারের স্বপ্ন: "${dreamTrimmed}"${hardDirective}`
        : `${dreamTrimmed}${hardDirective}`;
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
                    max_tokens: 1500 // history truncation যোগ হওয়ায় এখানে কিছুটা কমানো হলো, TPM safety margin রাখতে
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
