// ── /api/admin/symbols.js ──────────────────────────────────
// GET    → সব প্রতীক লিস্ট (অথবা ?category=animal দিয়ে filter)
// POST   → নতুন প্রতীক যোগ
// PUT    → বিদ্যমান প্রতীক এডিট (body-তে id লাগবে)
// DELETE → প্রতীক ডিলিট (?id=... দিয়ে)
export default async function handler(req, res) {
    try {
        const { requireAdmin } = await import('../../lib/adminAuth.js');
        requireAdmin(req);
        const { sql } = await import('../../lib/db.js');

        if (req.method === 'GET') {
            const { category, search } = req.query;
            let rows;
            if (category && search) {
                rows = await sql`SELECT * FROM symbols WHERE category = ${category} AND symbol ILIKE ${'%' + search + '%'} ORDER BY id DESC`;
            } else if (category) {
                rows = await sql`SELECT * FROM symbols WHERE category = ${category} ORDER BY id DESC`;
            } else if (search) {
                rows = await sql`SELECT * FROM symbols WHERE symbol ILIKE ${'%' + search + '%'} ORDER BY id DESC`;
            } else {
                rows = await sql`SELECT * FROM symbols ORDER BY id DESC LIMIT 500`;
            }
            return res.status(200).json({ symbols: rows });
        }

        if (req.method === 'POST') {
            const { category, symbol, aliases, core_meaning, polarity, modifiers, companion_animal } = req.body || {};
            if (!category || !symbol || !core_meaning) {
                return res.status(400).json({ error: 'category, symbol, core_meaning আবশ্যক।' });
            }
            const rows = await sql`
                INSERT INTO symbols (category, symbol, aliases, core_meaning, polarity, modifiers, companion_animal)
                VALUES (${category}, ${symbol}, ${aliases || []}, ${core_meaning}, ${polarity || 'neutral'},
                        ${modifiers ? JSON.stringify(modifiers) : null}, ${companion_animal ? JSON.stringify(companion_animal) : null})
                RETURNING *
            `;
            return res.status(201).json({ symbol: rows[0] });
        }

        if (req.method === 'PUT') {
            const { id, category, symbol, aliases, core_meaning, polarity, modifiers, companion_animal } = req.body || {};
            if (!id) return res.status(400).json({ error: 'id আবশ্যক।' });
            const rows = await sql`
                UPDATE symbols SET
                    category = ${category}, symbol = ${symbol}, aliases = ${aliases || []},
                    core_meaning = ${core_meaning}, polarity = ${polarity || 'neutral'},
                    modifiers = ${modifiers ? JSON.stringify(modifiers) : null},
                    companion_animal = ${companion_animal ? JSON.stringify(companion_animal) : null},
                    updated_at = now()
                WHERE id = ${id}
                RETURNING *
            `;
            return res.status(200).json({ symbol: rows[0] });
        }

        if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id) return res.status(400).json({ error: 'id আবশ্যক।' });
            await sql`DELETE FROM symbols WHERE id = ${id}`;
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        if (e.message === 'UNAUTHORIZED') return res.status(401).json({ error: 'লগইন করুন।' });
        console.error('Symbols API error:', e);
        return res.status(500).json({ error: 'ডিবাগ এরর: ' + e.message });
    }
}
