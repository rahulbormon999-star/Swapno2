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

ইনপুট-টাইপ: প্রতিটা ইউজার বার্তার সাথে একটা "[সিস্টেম-নির্ধারিত ইনপুট-টাইপ: ...]" ট্যাগ জুড়ে দেওয়া হবে — এটা কোড দিয়ে আগেই নির্ধারণ করা, আপনাকে নিজে অনুমান করতে হবে না। এই তিনটার একটা আসবে, ট্যাগে যা লেখা থাকবে ঠিক সেই নির্দেশ অনুসরণ করুন:
(ক) নতুন স্বপ্ন — নিচের কাঠামো মেনে সম্পূর্ণ ব্যাখ্যা দিন।
(খ) প্রসঙ্গ-প্রশ্নের উত্তর — আগের স্বপ্নের সাথে তথ্য যুক্ত করে পরিমার্জিত ব্যাখ্যা দিন, একই কাঠামো মেনে।
(গ) সাধারণ প্রশ্ন/পরামর্শ — কাঠামো ব্যবহার করবেন না, স্বাভাবিক কথোপকথনের ভাষায় সরাসরি উত্তর দিন, প্রয়োজনে **বোল্ড** ব্যবহার করুন।

"প্রাসঙ্গিক প্রশ্ন" নিয়ে কড়া নিয়ম: ট্যাগে যা জিজ্ঞেস করতে বলা হয়েছে ঠিক শুধু সেটাই জিজ্ঞেস করুন — নিজে থেকে ওপেন-এন্ডেড লাইফ-কোচিং/উপদেশমূলক প্রশ্ন বানাবেন না।

শৈলী: জেমিনির মতো বন্ধুত্বপূর্ণ, সাবলীল, বাস্তবমুখী ও ইতিবাচক বাংলায় উত্তর দিন। রোবট বা মুখস্থ ফরম্যাট পরিহার করুন। অপ্রয়োজনীয় দীর্ঘ ভূমিকা/উপসংহার বাদ দিয়ে সরাসরি মূল কথায় আসুন। কুসংস্কার বা ভয় ছড়াবেন না, ভবিষ্যৎ নিশ্চিতভাবে দাবি করবেন না।

(ক) ও (খ) এর জন্য কাঠামো — কোনো ইমোজি/আইকন ব্যবহার করবেন না, শুধু **বোল্ড** টেক্সট দিয়ে হেডার ও গুরুত্বপূর্ণ শব্দ চিহ্নিত করুন। কড়া নিয়ম: সর্বোচ্চ ২৫০ শব্দ — এর বেশি কখনো লিখবেন না, প্রতিটা সেকশন সংক্ষিপ্ত রাখুন (প্রতিটা সেকশনে সর্বোচ্চ ২-৩টা বুলেট বা ২-৩টা বাক্য):
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

// dream টেক্সটে স্থান/অনুভূতির ইঙ্গিত আছে কিনা তা keyword দিয়ে যাচাই করা হয় (deterministic check)
const EMOTION_HINTS = [
       'ভয়','ভীত','আতঙ্ক','ভীতসন্ত্রস্ত','আনন্দ','খুশি','সুখ','উচ্ছ্বাস','দুঃখ','কষ্ট','বিষণ্ন','হতাশ','উদ্বেগ','চিন্তা','চিন্তিত','অস্থির','রাগ','ক্ষোভ','বিরক্ত','অবাক','বিস্মিত','আশ্চর্য','শান্তি','স্বস্তি','নিরাপদ','ভালোলাগা','ভালোবাসা','স্নেহ','খারাপ লাগা','অসন্তোষ','কান্না','হাসি','লজ্জা','অপরাধবোধ','ঈর্ষা','হিংসা','গর্ব','আত্মবিশ্বাস','একাকীত্ব','নিঃসঙ্গতা','কৌতূহল','বিস্ময়','অসহায়','দুর্বল','মুগ্ধ','আশাবাদী','নিরাশ'
      ];
const LOCATION_HINTS = [
       'বাসা','বাড়ি','ঘর','রুম','কক্ষ','বারান্দা','ছাদ','উঠান','রাস্তা','গলি','মোড়','সেতু','ব্রিজ','অফিস','কারখানা','স্কুল','কলেজ','বিশ্ববিদ্যালয়','মাঠ','পার্ক','বাগান','জঙ্গল','বন','পানি','নদী','পুকুর','লেক','খাল','ঝর্ণা','সাগর','সমুদ্র','তীর','দ্বীপ','পাহাড়','গুহা','মরুভূমি','গ্রাম','শহর','বিদেশ','বাজার','দোকান','মল','রেস্টুরেন্ট','হাসপাতাল','ক্লিনিক','মন্দির','মসজিদ','গির্জা','আশ্রম','কবরস্থান','শ্মশান','ট্রেন','বাস','স্টেশন','বিমান','বিমানবন্দর','জাহাজ','বিয়েবাড়ি','অনুষ্ঠান','মেলা','আকাশ','মেঘ','চাঁদ','সূর্য'
       ];

function detectMissingContext(text) {
    const t = text.toLowerCase();
    const missing = [];
    if (!LOCATION_HINTS.some(k => t.includes(k))) missing.push('স্থান (স্বপ্নটি কোথায় ঘটেছিল)');
    if (!EMOTION_HINTS.some(k => t.includes(k))) missing.push('তখনকার মানসিক অনুভূতি (ভয়/আনন্দ/উদ্বেগ ইত্যাদি)');
    return missing;
}
// dream টেক্সট + history দেখে ইনপুট-টাইপ কোডেই নির্ধারণ করা হয় — LLM-কে অনুমান করতে হয় না
const NEW_DREAM_MARKERS = ['স্বপ্নে দেখলাম', 'স্বপ্ন দেখলাম', 'স্বপ্নে দেখি', 'স্বপ্ন দেখি', 'আমি দেখলাম যে', 'স্বপ্নটা ছিল', 'স্বপ্নে আমি'];
const QUESTION_MARKERS = ['কিভাবে', 'কীভাবে', 'কেন', 'কী করব', 'কি করব', 'বুঝিয়ে বল', 'মানে কি', 'মানে কী', '?'];

function classifyInput(dreamText, contextQuestionAlreadyAsked) {
    const t = dreamText.trim();
    const wordCount = t.split(/\s+/).length;
    const looksLikeNewDream = NEW_DREAM_MARKERS.some(m => t.includes(m));
    const looksLikeQuestion = QUESTION_MARKERS.some(m => t.includes(m));

    // নতুন স্বপ্নের marker সবচেয়ে বেশি অগ্রাধিকার পায়
    if (looksLikeNewDream) return 'new_dream'; // (ক)
    // এরপর প্রশ্নবাচক marker — এটা context_answer-এর আগে চেক করা জরুরি,
    // নাহলে "কিভাবে আত্মবিশ্বাস বাড়াবো" জাতীয় স্পষ্ট প্রশ্নও ভুলভাবে context_answer হয়ে যায়
    if (looksLikeQuestion) return 'general_question'; // (গ)
    // প্রশ্ন/নতুন-স্বপ্নের কোনো marker নেই, আগে context-প্রশ্ন হয়েছে, ছোট উত্তর — তাহলে context_answer
    if (contextQuestionAlreadyAsked && wordCount <= 25) return 'context_answer'; // (খ)
    return 'new_dream'; // ডিফল্ট
}

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

    // ── ইনপুট-টাইপ কোডেই নির্ধারণ (LLM-এর অনুমানের ওপর নির্ভর না করে) ──
    const dreamTrimmed = dream.trim();

    // history থেকে আগে বোঝা হচ্ছে আগের বার্তায় প্রাসঙ্গিক প্রশ্ন হয়েছিল কিনা
    let contextQuestionAlreadyAsked = false;
    if (Array.isArray(history) && history.length > 0) {
        const recentCheck = history.slice(-2);
        for (const msg of recentCheck) {
            if (msg.role === 'ai' && msg.text && msg.text.includes('প্রাসঙ্গিক প্রশ্ন')) {
                contextQuestionAlreadyAsked = true;
            }
        }
    }

    const inputType = classifyInput(dreamTrimmed, contextQuestionAlreadyAsked); // 'new_dream' | 'context_answer' | 'general_question'

    // RAG শুধু নতুন স্বপ্ন বা প্রসঙ্গ-উত্তরের ক্ষেত্রে দরকার, সাধারণ প্রশ্নে না (টোকেন বাঁচাতে)
    const matchedSymbols = inputType !== 'general_question' ? findMatchedSymbols(dreamTrimmed) : [];
    const contextBlock = inputType !== 'general_question' ? buildContextBlock(matchedSymbols, dreamTrimmed) : '';

    // Conversation history build করো
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    if (Array.isArray(history) && history.length > 0) {
        const recent = history.slice(-2); // হিস্ট্রি আরও সংকুচিত করা হলো টোকেন বাঁচাতে
        for (const msg of recent) {
            // প্রতিটা history message ৫০০ ক্যারেক্টারে truncate করা হচ্ছে (টোকেন বাঁচাতে)
            const truncated = msg.text && msg.text.length > 500
                ? msg.text.slice(0, 500) + '...'
                : msg.text;
            if (msg.role === 'user') messages.push({ role: 'user', content: truncated });
            else if (msg.role === 'ai') messages.push({ role: 'assistant', content: truncated });
        }
    }

    // ইনপুট-টাইপ অনুযায়ী স্পষ্ট নির্দেশ — LLM-কে ক্যাটেগরি বেছে নিতে হবে না, শুধু অনুসরণ করতে হবে
    let contextDirective;
    if (inputType === 'context_answer') {
        contextDirective = '\n[সিস্টেম-নির্ধারিত ইনপুট-টাইপ: (খ) প্রসঙ্গ-প্রশ্নের উত্তর। ইতিহাসে থাকা আগের স্বপ্নের সাথে এই তথ্য যুক্ত করে "এই তথ্য যোগ করার পর, আপনার স্বপ্নের অর্থ আরও স্পষ্ট হচ্ছে —" দিয়ে শুরু করে পরিমার্জিত ব্যাখ্যা দিন। আর কোনো নতুন তথ্য-সংগ্রহের প্রশ্ন করবেন না — "প্রাসঙ্গিক প্রশ্ন" অংশে শুধু একটা ছোট, সাধারণ কথোপকথনমূলক প্রশ্ন দিন। অবশ্যই সম্পূর্ণ কাঠামো ব্যবহার করুন — **স্বপ্নের মূল বার্তা:**, **প্রতীক ও ব্যাখ্যা:**, **বাস্তব জীবনের সংযোগ ও করণীয়:**, **প্রাসঙ্গিক প্রশ্ন:** — চারটা অংশই থাকতে হবে, সংক্ষিপ্ত এক-প্যারাগ্রাফ উত্তর দেবেন না।]';
    } else if (inputType === 'general_question') {
        contextDirective = '\n[সিস্টেম-নির্ধারিত ইনপুট-টাইপ: (গ) সাধারণ প্রশ্ন/পরামর্শ — নতুন স্বপ্ন বা প্রসঙ্গ-প্রশ্নের উত্তর নয়। নির্দিষ্ট কাঠামো (মূল বার্তা/প্রতীক/করণীয়/প্রশ্ন বিভাজন) ব্যবহার করবেন না। স্বাভাবিক কথোপকথনের ভাষায় সরাসরি উত্তর দিন, প্রয়োজনে **বোল্ড** দিয়ে গুরুত্বপূর্ণ অংশ হাইলাইট করুন।]';
    } else {
        const missing = detectMissingContext(dreamTrimmed);
        contextDirective = missing.length > 0
            ? `\n[সিস্টেম-নির্ধারিত ইনপুট-টাইপ: (ক) নতুন স্বপ্ন। এই স্বপ্নের বর্ণনায় নিচের তথ্য অনুপস্থিত: ${missing.join(' এবং ')}। "প্রাসঙ্গিক প্রশ্ন" অংশে এই অনুপস্থিত তথ্যটি (গুলো) নিয়েই সরাসরি, নির্দিষ্ট প্রশ্ন করুন। অন্য কোনো ধরনের প্রশ্ন করবেন না।]`
            : '\n[সিস্টেম-নির্ধারিত ইনপুট-টাইপ: (ক) নতুন স্বপ্ন। এই স্বপ্নের বর্ণনায় স্থান ও অনুভূতি উভয়ই উল্লেখ আছে। তাই "প্রাসঙ্গিক প্রশ্ন" অংশে কোনো তথ্য-সংগ্রহ প্রশ্ন করবেন না, শুধু একটা ছোট, সাধারণ কথোপকথনমূলক প্রশ্ন দিন।]';
    }

    const userContent = contextBlock
        ? `${contextBlock}\nইউজারের বার্তা: "${dreamTrimmed}"${contextDirective}`
        : `${dreamTrimmed}${contextDirective}`;
    messages.push({ role: 'user', content: userContent });

    // Visitor track (async)
    trackVisitor(ip).catch(() => {});

    // প্রাইমারি মডেল দিয়ে সব key চেষ্টা করা হচ্ছে
    for (let i = 0; i < keys.length; i++) {
        try {
            const result = await callGroq(keys[i], 'llama-3.3-70b-versatile', messages, 1900, 28000);
            if (result.retry) continue; // 429/503 হলে পরের key
            if (result.error) throw result.error;

            saveStats(result.usage.prompt_tokens || 0, result.usage.completion_tokens || 0).catch(() => {});
            return res.status(200).json({ text: result.text });

        } catch (e) {
            if (i < keys.length - 1) continue;
            // সব key প্রাইমারি মডেলে fail করলে, নিচে fallback মডেল চেষ্টা করা হবে (loop থেকে বের হয়ে)
        }
    }

    // ── Fallback: llama-3.3-70b organization-wide TPM লিমিটে আটকালে,
    // আলাদা/হালকা মডেলে (আলাদা TPM বাজেট) একবার চেষ্টা করা হচ্ছে — যাতে ইউজার raw error না দেখেন
    try {
        const fallback = await callGroq(keys[0], 'llama-3.1-8b-instant', messages, 1500, 20000);
        if (!fallback.retry && !fallback.error) {
            saveStats(fallback.usage.prompt_tokens || 0, fallback.usage.completion_tokens || 0).catch(() => {});
            return res.status(200).json({ text: fallback.text });
        }
    } catch (e) { /* নিচের generic error-এ পড়বে */ }

    return res.status(429).json({ error: 'AI সার্ভার এই মুহূর্তে ব্যস্ত আছে। কিছুক্ষণ পর আবার চেষ্টা করুন।' });
}

// একটা single Groq API call করার helper — key/model/timeout প্যারামিটার হিসেবে নেয়
async function callGroq(apiKey, model, messages, maxTokens, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.7,
                max_tokens: maxTokens
            }),
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (groqRes.status === 429 || groqRes.status === 503) return { retry: true };

        if (!groqRes.ok) {
            const err = await groqRes.json().catch(() => ({}));
            return { error: new Error(err?.error?.message || `Groq error ${groqRes.status}`) };
        }

        const data = await groqRes.json();
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (!text) return { error: new Error('Empty response') };

        return { text, usage: data.usage || {} };
    } catch (e) {
        clearTimeout(timeout);
        return { error: e };
    }
}
