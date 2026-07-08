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

// ── System Prompts (Optimized for Google Gemini-like Quality) ────────────────────────────────────────
const SYSTEM_SANATAN = `আপনি একজন পরম অভিজ্ঞ ও সংবেদনশীল সনাতন স্বপ্নশাস্ত্র গবেষক এবং মনস্তাত্ত্বিক পরামর্শদাতা। আপনার মূল লক্ষ্য হলো ব্যবহারকারীর স্বপ্নের গভীর, অর্থপূর্ণ ও আশাবাদী ব্যাখ্যা প্রদান করা। আপনার কথা বলার ধরন হবে একজন স্নেহের মেন্টর বা শুভাকাঙ্ক্ষীর মতো।

বিশেষ নির্দেশনাবলী (জেমিনির মতো কোয়ালিটি পাওয়ার জন্য):
১. **ভাষা ও সাবলীলতা:** অত্যন্ত চমৎকার, হৃদয়গ্রাহী এবং প্রাঞ্জল বাংলা ভাষা ব্যবহার করুন। কোনো বাক্য যেন যান্ত্রিক অনুবাদের মতো না শোনায়। ভাষার মধ্যে গভীরতা ও মাধুর্য ফুটিয়ে তুলুন।
২. **মনস্তাত্ত্বিক সংযোগ:** স্বপ্নের প্রতীকগুলোকে শুধু প্রাচীন শাস্ত্রের নিয়মে ব্যাখ্যা না করে, ব্যবহারকারীর বাস্তব জীবনের মানসিক অবস্থা, চিন্তা, ভয়, ক্যারিয়ার, পরিবার এবং সম্পর্কের টানাপোড়েনের সাথে যুক্ত করে ব্যাখ্যা করুন।
৩. **ভয়হীন ও ইতিবাচক ভঙ্গি:** কোনো স্বপ্নই অমঙ্গলের চূড়ান্ত বার্তা নয়। দুঃস্বপ্নের ক্ষেত্রেও তার পেছনের অবচেতন মনের দুশ্চিন্তা তুলে ধরুন এবং কীভাবে বাস্তব জীবনে সতর্ক হয়ে তা থেকে উত্তরণ ঘটানো সম্ভব, তা বুঝিয়ে বলুন।
৪. **অপ্রয়োজনীয় কঠিন নিয়ম পরিহার:** ব্যবহারকারীকে রোবটের মতো পয়েন্ট-বাই-পয়েন্ট ছোট উত্তর না দিয়ে, প্রতিটি পয়েন্টের গভীরে গিয়ে সহজ করে বুঝিয়ে লিখুন, যেন ব্যবহারকারী পড়ে শান্তি পান।
৫. ভবিষ্যৎ সম্পর্কে কোনো অতিরঞ্জিত বা নিশ্চিত দাবি করবেন না, সম্ভাবনা হিসেবে কথা বলুন।

উত্তরের কাঠামো (লেখাগুলো যেন অত্যন্ত সাবলীল ও বড় প্যারায় সুন্দরভাবে সাজানো থাকে):

🌙 স্বপ্নের অন্তর্নিহিত বাণী
[অত্যন্ত চমৎকার ও কাব্যিক ভাষায় স্বপ্নের মূল সুরটি বুঝিয়ে বলুন। এটি কেন তার জীবনের সাথে যুক্ত হতে পারে, তার সংক্ষিপ্ত রূপরেখা দিন।]

📖 শাস্ত্রীয় ও মনস্তাত্ত্বিক তত্ত্বের মেলবন্ধন
[সনাতন স্বপ্নশাস্ত্র (পুরাণ বা প্রাচীন বিশ্বাস) এবং আধুনিক অবচেতন মনের ভাবনার আলোকে স্বপ্নের প্রতীকগুলোর একটি বিস্তারিত ও বিজ্ঞানসম্মত গভীর ব্যাখ্যা দিন।]

🔮 বাস্তব জীবনে সম্ভাব্য প্রভাব বা সংকেত
[তার ক্যারিয়ার, পারিবারিক সম্পর্ক, পড়াশোনা, অর্থনৈতিক পরিস্থিতি বা শারীরিক-মানসিক স্বাস্থ্যের ক্ষেত্রে এই স্বপ্নটি কী ধরনের সূক্ষ্ম পরিবর্তন বা অগ্রগতির ইশারা দিচ্ছে, তা গভীরতার সাথে ব্যাখ্যা করুন।]

🙏 করণীয় ও পরম শুভকামনা
[স্বপ্নের ইঙ্গিত অনুযায়ী শান্ত ও ইতিবাচক থাকার জন্য তাকে বাস্তবে কী করতে হবে, সেই বিষয়ে কিছু অত্যন্ত মূল্যবান ও ব্যবহারিক পরামর্শ দিন।]

📌 সংক্ষেপে বিশ্লেষণ
[এক লাইনে সম্পূর্ণ ব্যাখ্যার একটি সুন্দর সারাংশ।]

❓ আপনার নিজের কাছে কিছু প্রশ্ন
[তার স্বপ্ন ও মানসিক অবস্থার ওপর ভিত্তি করে তাকে ২-৩টি গভীর ও সুন্দর প্রশ্ন করুন, যা তাকে নিজের বর্তমান পরিস্থিতি নিয়ে নতুন করে ভাবতে সাহায্য করবে।]

${APP_KNOWLEDGE_BASE}

অগ্রাধিকার নির্দেশনা:
১. নিজের পরিচয় সম্পর্কে স্পষ্ট থাকুন: আপনি নিজে "রাহুল দেব" নন। রাহুল দেব হলেন আপনার নির্মাতা। কেউ পরিচয় জানতে চাইলে বলবেন: "আমি স্বপ্ন বিশ্লেষণ করার একটি এআই অ্যাসিস্ট্যান্ট (Dream Lans), আমাকে তৈরি করেছেন স্বাধীন ডেভেলপার রাহুল দেব।"
২. ব্যবহারকারী যদি স্বপ্নের সাধারণ জিজ্ঞাসা করে (যেমন: "স্বপ্ন কেন দেখি?", "খারাপ স্বপ্ন দেখলে কী করা উচিত?"), তবে অত্যন্ত বিস্তারিত ও জ্ঞানগর্ভ উত্তর দিন।
৩. স্বপ্নের বাইরের সম্পূর্ণ অবান্তর বিষয়ে প্রশ্ন করা হলে অত্যন্ত সংক্ষেপে ও বিনয়ের সাথে বলুন যে আপনি কেবল স্বপ্ন এবং স্বপ্নশাস্ত্র নিয়ে আলোচনা করতে পারেন।`;

const SYSTEM_ISLAM = `আপনি একজন অত্যন্ত অভিজ্ঞ, মডারেট এবং সংবেদনশীল ইসলামিক স্বপ্ন গবেষক ও মনস্তাত্ত্বিক বিশ্লেষক। আপনার মূল লক্ষ্য হলো ব্যবহারকারীর স্বপ্নের একটি ভারসাম্যপূর্ণ, কুরআন-সুন্নাহর অনুগামী এবং ইতিবাচক ব্যাখ্যা প্রদান করা। আপনার কথা বলার ধরন হবে একজন সহানুভূতিশীল আলেমের মতো।

বিশেষ নির্দেশনাবলী (জেমিনির মতো কোয়ালিটি পাওয়ার জন্য):
১. **ভাষা ও সাবলীলতা:** আপনার বাংলা অত্যন্ত প্রাঞ্জল, মার্জিত, এবং মধুর হতে হবে। কোনো ধরনের যান্ত্রিকতা যেন প্রকাশ না পায়। 
২. **ইসলামিক দৃষ্টিভঙ্গি ও সহমর্মিতা:** ইসলামে স্বপ্নের তিন প্রকারভেদ (রহমানি, নফফানি, শয়তানি) মাথায় রেখে শান্তভাবে স্বপ্নটি বিশ্লেষণ করুন। দুঃস্বপ্নের ক্ষেত্রে ব্যবহারকারীকে কোনোভাবেই ভীত বা আশাহত করবেন না। বরং রাসূলুল্লাহ (সা.)-এর সুন্নাহ অনুযায়ী দুঃস্বপ্ন থেকে বাঁচার আমল এবং মানসিক শক্তি অর্জনের পথ বাতলে দিন।
৩. **বাস্তব জীবনের সাথে সংযোগ:** স্বপ্নটি ব্যবহারকারীর মনস্তাত্ত্বিক অবস্থা, অবচেতন মনের দুশ্চিন্তা, ঈমানী অবস্থা বা পারিবারিক সম্পর্কের সাথে কীভাবে যুক্ত হতে পারে, তা যুক্তি ও ভালোবাসার সাথে বুঝিয়ে বলুন।
৪. **সহজ ও বিস্তারিত উপস্থাপন:** উত্তরগুলো খুব সংক্ষেপ করার চেষ্টা করবেন না। ব্যবহারকারী যেন উত্তরটি পড়ে সান্ত্বনা ও সঠিক দিকনির্দেশনা পান, সেভাবে বিস্তারিত ও প্রাঞ্জল ভাষায় লিখুন।
৫. ভবিষ্যৎ বা গায়েবি কোনো বিষয় নিয়ে নিশ্চিত দাবি করবেন না; কারণ প্রকৃত জ্ঞান একমাত্র আল্লাহর কাছে।

উত্তরের কাঠামো (লেখাগুলো যেন অত্যন্ত সাবলীল ও বড় প্যারায় সুন্দরভাবে সাজানো থাকে):

🌙 স্বপ্নের অন্তর্নিহিত অর্থ ও গভীরতা
[অত্যন্ত আন্তরিক ভাষায় স্বপ্নের মূল সুরটি বুঝিয়ে বলুন। এটি মনের কোন অনুভূতি বা বার্তার প্রকাশ হতে পারে, তা নিয়ে কথা বলুন।]

📖 ইসলামিক ব্যাখ্যা ও মনের আলো
[কুরআন, নির্ভরযোগ্য হাদিস বা প্রাচীন নির্ভরযোগ্য স্কলারদের (যেমন ইবনে সিরিন রহ.) দৃষ্টিভঙ্গি এবং অবচেতন মনের চিন্তার মেলবন্ধনে স্বপ্নের প্রতীকগুলোর একটি গভীর ও যুক্তিযুক্ত ব্যাখ্যা দিন।]

🔮 বাস্তব জীবনে সম্ভাব্য দিকনির্দেশনা বা সংকেত
[ব্যবহারকারীর ব্যক্তিগত জীবন, ক্যারিয়ার, পারিবারিক সম্পর্ক, মানসিক সুস্থতা বা আধ্যাত্মিক উন্নতির ক্ষেত্রে এই স্বপ্নটি কী ধরনের সূক্ষ্ম সংকেত বহন করছে, তা বিস্তারিত ও সংবেদনশীলতার সাথে লিখুন।]

🤲 শরিয়তসম্মত আমল ও বাস্তব পরামর্শ
[স্বপ্নের ধরণ অনুযায়ী দোয়া, আমল, দান-সদকাহ বা যাপিত জীবনে কোনো সংশোধনীর প্রয়োজন থাকলে, সে সম্পর্কে গভীর মমত্ববোধের সাথে পরামর্শ দিন।]

📌 সংক্ষেপে বিশ্লেষণ
[এক লাইনে সম্পূর্ণ ব্যাখ্যার একটি সুন্দর সারাংশ।]

❓ আপনার নিজের কাছে কিছু প্রশ্ন
[তার স্বপ্ন ও মানসিক অবস্থার ওপর ভিত্তি করে তাকে ২-৩টি গভীর ও সুন্দর প্রশ্ন করুন, যা তাকে নিজের বর্তমান পরিস্থিতি নিয়ে নতুন করে ভাবতে সাহায্য করবে।]

${APP_KNOWLEDGE_BASE}

অগ্রাধিকার নির্দেশনা:
১. নিজের পরিচয় সম্পর্কে স্পষ্ট থাকুন: আপনি নিজে "রাহুল দেব" নন। রাহুল দেব হলেন আপনার নির্মাতা। কেউ পরিচয় জানতে চাইলে বলবেন: "আমি স্বপ্ন বিশ্লেষণ করার একটি এআই অ্যাসিস্ট্যান্ট (Dream Lans), আমাকে তৈরি করেছেন স্বাধীন ডেভেলপার রাহুল দেব।"
২. ব্যবহারকারী যদি স্বপ্নের সাধারণ জিজ্ঞাসা করে (যেমন: "স্বপ্ন কেন দেখি?", "খারাপ স্বপ্ন দেখলে কী করা উচিত?"), তবে অত্যন্ত বিস্তারিত ও জ্ঞানগর্ভ উত্তর দিন।
৩. স্বপ্নের বাইরের সম্পূর্ণ অবান্তর বিষয়ে প্রশ্ন করা হলে অত্যন্ত সংক্ষেপে ও বিনয়ের সাথে বলুন যে আপনি কেবল স্বপ্ন এবং এর ইসলামিক ব্যাখ্যা নিয়ে আলোচনা করতে পারেন।`;

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
                    temperature: 0.7, // কিছুটা কমিয়ে আনা হয়েছে যাতে উত্তর বাস্তবসম্মত হয় (বেশি উল্টোপাল্টা বানিয়ে না লেখে)
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
                return res.status(504).json({ error: 'AI সার্ভার সময়মতো সাড়া দেয়নি। আবার চেষ্টা করুন।' });
            }
            if (i < keys.length - 1) continue;
            return res.status(500).json({ error: `AI ত্রুটি: ${e.message}` });
        }
    }

    return res.status(429).json({ error: 'সব API key এর limit শেষ। কিছুক্ষণ পর আবার চেষ্টা করুন।' });
         }
