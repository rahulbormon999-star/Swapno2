// ── /api/admin/dashboard.js ────────────────────────────────
export default async function handler(req, res) {
    try {
        const { requireAdmin } = await import('../../lib/adminAuth.js');
        requireAdmin(req);

        const { sql } = await import('../../lib/db.js');

        const [totalUsers] = await sql`SELECT COUNT(*) AS count FROM users`;
        const genderBreakdown = await sql`
            SELECT COALESCE(gender, 'unknown') AS gender, COUNT(*) AS count
            FROM users GROUP BY gender
        `;
        const dailyTokens = await sql`
            SELECT DATE(created_at) AS day,
                   SUM(prompt_tokens + completion_tokens) AS total_tokens,
                   COUNT(*) AS total_conversations
            FROM conversations
            WHERE created_at > now() - interval '30 days'
            GROUP BY DATE(created_at)
            ORDER BY day DESC
        `;
        const topSymbols = await sql`
            SELECT unnest(matched_symbols) AS symbol, COUNT(*) AS count
            FROM conversations
            WHERE matched_symbols IS NOT NULL
            GROUP BY symbol
            ORDER BY count DESC
            LIMIT 20
        `;
        const unmatchedCount = await sql`
            SELECT COUNT(*) AS count FROM unmatched_queries WHERE reviewed = false
        `;
        const totalConversationsToday = await sql`
            SELECT COUNT(*) AS count FROM conversations WHERE created_at::date = CURRENT_DATE
        `;
        const feedbackSummary = await sql`
            SELECT rating, COUNT(*) AS count FROM feedback GROUP BY rating
        `;

        return res.status(200).json({
            totalUsers: totalUsers.count,
            genderBreakdown,
            dailyTokens,
            topSymbols,
            unmatchedCount: unmatchedCount[0].count,
            totalConversationsToday: totalConversationsToday[0].count,
            feedbackSummary
        });

    } catch (e) {
        if (e.message === 'UNAUTHORIZED') return res.status(401).json({ error: 'লগইন করুন।' });
        console.error('Dashboard error:', e);
        return res.status(500).json({ error: 'ডিবাগ এরর: ' + e.message });
    }
}
