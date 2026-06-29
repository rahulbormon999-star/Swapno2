export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    // ── Secret key check — শুধু আপনি access করতে পারবেন ──
    const adminKey = req.headers['x-admin-key'] || req.query.key;
    if (adminKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const url   = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        return res.status(500).json({ error: 'Redis not configured' });
    }

    // ── শেষ ৩০ দিনের date list ───────────────────────────
    const days = [];
    const months = new Set();
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dk = d.toISOString().slice(0, 10);
        const mk = d.toISOString().slice(0, 7);
        days.push(dk);
        months.add(mk);
    }
    const monthList = [...months];

    // ── Pipeline — সব data একসাথে fetch ─────────────────
    const cmds = [
        // মোট stats
        ['GET', 'stats:searches:total'],
        ['GET', 'stats:tokens:total'],
        ['PFCOUNT', 'stats:visitors:total'],
        ['GET', 'stats:religion:sanatan'],
        ['GET', 'stats:religion:islam'],

        // দৈনিক সার্চ (৩০ দিন)
        ...days.map(d => ['GET', `stats:searches:daily:${d}`]),

        // দৈনিক token (৩০ দিন)
        ...days.map(d => ['GET', `stats:tokens:daily:${d}`]),

        // দৈনিক unique visitor (৩০ দিন)
        ...days.map(d => ['PFCOUNT', `stats:visitors:daily:${d}`]),

        // মাসিক সার্চ
        ...monthList.map(m => ['GET', `stats:searches:monthly:${m}`]),

        // মাসিক token
        ...monthList.map(m => ['GET', `stats:tokens:monthly:${m}`]),
    ];

    try {
        const pipeRes = await fetch(`${url}/pipeline`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cmds)
        });

        const pipeData = await pipeRes.json();
        const results  = pipeData.map(r => r.result || 0);

        let idx = 0;
        const totalSearches  = parseInt(results[idx++]) || 0;
        const totalTokens    = parseInt(results[idx++]) || 0;
        const totalVisitors  = parseInt(results[idx++]) || 0;
        const sanatonCount   = parseInt(results[idx++]) || 0;
        const islamCount     = parseInt(results[idx++]) || 0;

        const dailySearches  = days.map(d => ({ date: d, count: parseInt(results[idx++]) || 0 }));
        const dailyTokens    = days.map(d => ({ date: d, tokens: parseInt(results[idx++]) || 0 }));
        const dailyVisitors  = days.map(d => ({ date: d, visitors: parseInt(results[idx++]) || 0 }));
        const monthlySearches= monthList.map(m => ({ month: m, count: parseInt(results[idx++]) || 0 }));
        const monthlyTokens  = monthList.map(m => ({ month: m, tokens: parseInt(results[idx++]) || 0 }));

        // আজকের stats
        const today = new Date().toISOString().slice(0, 10);
        const todayData = dailySearches.find(d => d.date === today);
        const todayTokenData = dailyTokens.find(d => d.date === today);
        const todayVisitorData = dailyVisitors.find(d => d.date === today);

        return res.status(200).json({
            summary: {
                totalSearches,
                totalTokens,
                totalVisitors,
                todaySearches:  todayData?.count || 0,
                todayTokens:    todayTokenData?.tokens || 0,
                todayVisitors:  todayVisitorData?.visitors || 0,
                sanatonSearches: sanatonCount,
                islamSearches:   islamCount,
                generatedAt: new Date().toISOString()
            },
            daily: {
                searches: dailySearches,
                tokens:   dailyTokens,
                visitors: dailyVisitors
            },
            monthly: {
                searches: monthlySearches,
                tokens:   monthlyTokens
            }
        });

    } catch (e) {
        return res.status(500).json({ error: `Stats fetch error: ${e.message}` });
    }
          }
