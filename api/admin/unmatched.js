// ── /api/admin/unmatched.js ────────────────────────────────
export default async function handler(req, res) {
    try {
        const { requireAdmin } = await import('../../lib/adminAuth.js');
        requireAdmin(req);
        const { sql } = await import('../../lib/db.js');

        if (req.method === 'GET') {
            const rows = await sql`
                SELECT * FROM unmatched_queries
                WHERE reviewed = false
                ORDER BY created_at DESC
                LIMIT 200
            `;
            return res.status(200).json({ unmatched: rows });
        }

        if (req.method === 'PUT') {
            const { id } = req.body || {};
            if (!id) return res.status(400).json({ error: 'id আবশ্যক।' });
            await sql`UPDATE unmatched_queries SET reviewed = true WHERE id = ${id}`;
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        if (e.message === 'UNAUTHORIZED') return res.status(401).json({ error: 'লগইন করুন।' });
        console.error('Unmatched API error:', e);
        return res.status(500).json({ error: 'ডিবাগ এরর: ' + e.message });
    }
}
