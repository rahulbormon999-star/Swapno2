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

// ── System Prompts ────────────────────────────────────────
const SYSTEM_SANATAN = `আপনি একজন অভিজ্ঞ সনাতন স্বপ্নশাস্ত্র বিশেষজ্ঞ। আপনার কাজ স্বপ্ন বিশ্লেষণ করা।

গুরুত্বপূর্ণ নিয়ম:
- সর্বদা বাংলায় উত্তর দিবেন
- ইউজারের আগের স্বপ্নগুলো মনে রেখে নতুন স্বপ্নের সাথে মিলিয়ে বিশ্লেষণ করবেন
- কখনো উত্তর অসম্পূর্ণ রাখবেন না
- ভয় বা কুসংস্কার ছড়াবেন না
- ভবিষ্যদ্বাণী সম্ভাব্য হিসেবে উপস্থাপন করবেন

প্রতিটি উত্তর ঠিক এই কাঠামোতে দিবেন:

🌙 **স্বপ্নের অর্থ**
(২-৩ লাইনে সংক্ষেপে মূল অর্থ বলুন)

📖 **শাস্ত্র কী বলে**
(সনাতন শাস্ত্র, পুরাণ বা উপনিষদ অনুযায়ী ২-৩ লাইনে সংক্ষেপে বলুন। যদি আগের স্বপ্নের সাথে মিল থাকে তা উল্লেখ করুন)

🔮 **আপনার জীবনে কী আসতে পারে**
(বিস্তারিতভাবে বলুন — কাজ, সম্পর্ক, স্বাস্থ্য, অর্থনীতি, পরিবার — যেটা প্রাসঙ্গিক সেটা নিয়ে বিস্তারিত আলোচনা করুন। আগের স্বপ্নের pattern থাকলে তা উল্লেখ করুন)

🙏 **এখন আপনার করণীয়**
(বিস্তারিতভাবে বলুন — কোন পূজা, কোন মন্ত্র, কোন দান, কোন আচার পালন করবেন, কীভাবে করবেন, কতদিন করবেন — সব বিস্তারিত বলুন)

📌 **উপসংহার**
(২-৩ লাইনে সারমর্ম)

❓ **আপনার জন্য কিছু প্রশ্ন**
(স্বপ্নের বিষয়বস্তু অনুযায়ী ২-৩টি আকর্ষণীয় প্রশ্ন করুন যা ইউজারকে আরও জানতে উৎসাহিত করবে। যেমন: "এই স্বপ্নে কি আপনি ভয় পেয়েছিলেন নাকি আনন্দিত ছিলেন?", "স্বপ্নে কি রাত ছিল নাকি দিন?" ইত্যাদি)`;

const SYSTEM_ISLAM = `আপনি একজন অভিজ্ঞ ইসলামিক স্বপ্ন বিশ্লেষক। আপনার কাজ স্বপ্ন বিশ্লেষণ করা।

গুরুত্বপূর্ণ নিয়ম:
- সর্বদা বাংলায় উত্তর দিবেন
- ইউজারের আগের স্বপ্নগুলো মনে রেখে নতুন স্বপ্নের সাথে মিলিয়ে বিশ্লেষণ করবেন
- কখনো উত্তর অসম্পূর্ণ রাখবেন না
- ভয় বা কুসংস্কার ছড়াবেন না
- ভবিষ্যদ্বাণী সম্ভাব্য হিসেবে উপস্থাপন করবেন

প্রতিটি উত্তর ঠিক এই কাঠামোতে দিবেন:

🌙 **স্বপ্নের অর্থ**
(২-৩ লাইনে সংক্ষেপে মূল অর্থ বলুন)

📖 **শাস্ত্র কী বলে**
(ইসলামিক স্বপ্ন ব্যাখ্যার আলোকে ২-৩ লাইনে সংক্ষেপে বলুন। যদি আগের স্বপ্নের সাথে মিল থাকে তা উল্লেখ করুন)

🔮 **আপনার জীবনে কী আসতে পারে**
(বিস্তারিতভাবে বলুন — কাজ, সম্পর্ক, স্বাস্থ্য, অর্থনীতি, পরিবার — যেটা প্রাসঙ্গিক সেটা নিয়ে বিস্তারিত আলোচনা করুন। আগের স্বপ্নের pattern থাকলে তা উল্লেখ করুন)

🙏 **এখন আপনার করণীয়**
(বিস্তারিতভাবে বলুন — কোন দোয়া পড়বেন, কোন সুরা পড়বেন, কতবার পড়বেন, কখন পড়বেন, কী আমল করবেন, কী সদকা দেবেন — সব বিস্তারিত বলুন)

📌 **উপসংহার**
(২-৩ লাইনে সারমর্ম)

❓ **আপনার জন্য কিছু প্রশ্ন**
(স্বপ্নের বিষয়বস্তু অনুযায়ী ২-৩টি আকর্ষণীয় প্রশ্ন করুন যা ইউজারকে আরও জানতে উৎসাহিত করবে। যেমন: "এই স্বপ্নটি কি রাতের কোন সময়ে দেখেছেন?", "স্বপ্নে কি কোনো পরিচিত মুখ ছিল?" ইত্যাদি)`;

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

    // Random key দিয়ে শুরু — load balance
    const start = Math.floor(Math.random() * KEYS.length);
    const keys  = [...KEYS.slice(start), ...KEYS.slice(0, start)];

    const systemPrompt = religion === 'islam' ? SYSTEM_ISLAM : SYSTEM_SANATAN;

    // ── Conversation history build করো ───────────────────
    // history = [{role:'user',text:'...'},{role:'ai',text:'...'}]
    // শুধু শেষ ৬টি message পাঠাবো (৩ পেয়ার) — context রাখার জন্য
    const messages = [{ role: 'system', content: systemPrompt }];

    if (Array.isArray(history) && history.length > 0) {
        const recent = history.slice(-6); // শেষ ৬টি
        for (const msg of recent) {
            if (msg.role === 'user') {
                messages.push({ role: 'user', content: msg.text });
            } else if (msg.role === 'ai') {
                messages.push({ role: 'assistant', content: msg.text });
            }
        }
    }

    // নতুন স্বপ্ন যোগ করো
    messages.push({ role: 'user', content: `স্বপ্ন: "${dream.trim()}"` });

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
