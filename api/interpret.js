// Rate limiting — memory-based (Vercel serverless এ প্রতি instance আলাদা)
const rateLimitMap = new Map();

function isRateLimited(ip) {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 10; // প্রতি মিনিটে ১০টি request per IP

    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, { count: 1, start: now });
        return false;
    }

    const data = rateLimitMap.get(ip);
    if (now - data.start > windowMs) {
        rateLimitMap.set(ip, { count: 1, start: now });
        return false;
    }

    if (data.count >= maxRequests) return true;
    data.count++;
    return false;
}

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // IP rate limit
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
        return res.status(429).json({ error: 'অনেক বেশি request। ১ মিনিট পর আবার চেষ্টা করুন।' });
    }

    // Input validation
    const { dream, religion } = req.body || {};
    if (!dream || typeof dream !== 'string') {
        return res.status(400).json({ error: 'স্বপ্নের বর্ণনা প্রয়োজন' });
    }
    if (dream.length > 2000) {
        return res.status(400).json({ error: 'স্বপ্নের বর্ণনা অনেক বড়। ২০০০ অক্ষরের মধ্যে লিখুন।' });
    }

    // ৩টি Groq API key
    const API_KEYS = [
        process.env.GROQ_API_KEY_1,
        process.env.GROQ_API_KEY_2,
        process.env.GROQ_API_KEY_3,
    ].filter(Boolean);

    if (API_KEYS.length === 0) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const PROMPT_SANATAN = `আপনি একজন অভিজ্ঞ স্বপ্ন বিশ্লেষক ও সনাতন স্বপ্নশাস্ত্র বিশেষজ্ঞ।
ব্যবহারকারীর স্বপ্ন বিশ্লেষণ করে বিস্তারিত ব্যাখ্যা দিন।

নিয়ম:
- সর্বদা বাংলায় উত্তর দিবেন
- উত্তর বিস্তারিত ও সহজবোধ্য হবে
- কোনো স্বপ্ন উপেক্ষা করবেন না
- প্রতিটি প্রতীক আলাদা করে বিশ্লেষণ করবেন
- ভবিষ্যদ্বাণী শতভাগ নিশ্চিত বলবেন না
- ভয় বা কুসংস্কার ছড়াবেন না
- সনাতন স্বপ্নশাস্ত্র, পুরাণ, উপনিষদ বিবেচনা করুন
- করণীয়তে পূজা, জপ, দান বা আধ্যাত্মিক পরামর্শ দিন

উত্তরের কাঠামো:
🌙 **স্বপ্নের সারাংশ**
🔍 **বিস্তারিত বিশ্লেষণ**
✨ **সম্ভাব্য ইঙ্গিত**
🙏 **করণীয়**
📌 **উপসংহার**`;

    const PROMPT_ISLAM = `আপনি একজন অভিজ্ঞ ইসলামিক স্বপ্ন বিশ্লেষক ও স্বপ্নশাস্ত্র বিশেষজ্ঞ।
ব্যবহারকারীর স্বপ্ন বিশ্লেষণ করে বিস্তারিত ব্যাখ্যা দিন।

নিয়ম:
- সর্বদা বাংলায় উত্তর দিবেন
- উত্তর বিস্তারিত ও সহজবোধ্য হবে
- কোনো স্বপ্ন উপেক্ষা করবেন না
- প্রতিটি প্রতীক আলাদা করে বিশ্লেষণ করবেন
- ভবিষ্যদ্বাণী শতভাগ নিশ্চিত বলবেন না
- ভয় বা কুসংস্কার ছড়াবেন না
- ইসলামিক স্বপ্ন ব্যাখ্যার ঐতিহ্য ব্যবহার করুন
- করণীয়তে দোয়া, জিকির, ইস্তিগফার, সদকার পরামর্শ দিন
- ভাষা ইসলামিক সংস্কৃতির সাথে সামঞ্জস্যপূর্ণ হবে

উত্তরের কাঠামো:
🌙 **স্বপ্নের সারাংশ**
🔍 **বিস্তারিত বিশ্লেষণ**
✨ **সম্ভাব্য ইঙ্গিত**
🙏 **করণীয়**
📌 **উপসংহার**`;

    const systemPrompt = religion === 'islam' ? PROMPT_ISLAM : PROMPT_SANATAN;

    // Key rotate করো
    for (let i = 0; i < API_KEYS.length; i++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout

            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEYS[i]}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `স্বপ্ন: "${dream.trim()}"` }
                    ],
                    temperature: 0.75,
                    max_tokens: 3000
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (groqRes.status === 429 || groqRes.status === 503) {
                // Rate limit বা overload — পরের key try করো
                continue;
            }

            if (!groqRes.ok) {
                const err = await groqRes.json().catch(() => ({}));
                throw new Error(err?.error?.message || `Groq error ${groqRes.status}`);
            }

            const data = await groqRes.json();
            const text = data?.choices?.[0]?.message?.content;
            if (!text) throw new Error('Empty response from AI');

            return res.status(200).json({ text });

        } catch (e) {
            if (e.name === 'AbortError') {
                if (i === API_KEYS.length - 1) {
                    return res.status(504).json({ error: 'AI সার্ভার সময়মতো সাড়া দেয়নি। আবার চেষ্টা করুন।' });
                }
                continue;
            }
            if (i === API_KEYS.length - 1) {
                return res.status(500).json({ error: `AI ত্রুটি: ${e.message}` });
            }
        }
    }

    return res.status(429).json({ error: 'সব API key এর limit শেষ। কিছুক্ষণ পর আবার চেষ্টা করুন।' });
         }
