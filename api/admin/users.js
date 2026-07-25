// ── /api/admin/users.js ────────────────────────────────────
export default async function handler(req, res) {
    try {
        const { requireAdmin } = await import('../../lib/adminAuth.js');
        requireAdmin(req);
        const { sql } = await import('../../lib/db.js');

        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

        const rows = await sql`
            SELECT id, name, phone, email, gender, country, profession, created_at, last_seen
            FROM users
            ORDER BY last_seen DESC
            LIMIT 500
        `;
        return res.status(200).json({ users: rows });

    } catch (e) {
        if (e.message === 'UNAUTHORIZED') return res.status(401).json({ error: 'লগইন করুন।' });
        console.error('Users API error:', e);
        return res.status(500).json({ error: 'ডিবাগ এরর: ' + e.message });
    }
}
