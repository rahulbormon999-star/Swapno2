// ── /api/admin/login.js ────────────────────────────────────
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { sql } = await import('../../lib/db.js');
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ error: 'ইমেইল ও পাসওয়ার্ড দিন।' });
        }

        const rows = await sql`SELECT * FROM admin_users WHERE email = ${email}`;
        if (rows.length === 0) {
            return res.status(401).json({ error: 'ভুল ইমেইল বা পাসওয়ার্ড।' });
        }

        const admin = rows[0];
        const valid = await bcrypt.compare(password, admin.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'ভুল ইমেইল বা পাসওয়ার্ড।' });
        }

        const token = jwt.sign({ adminId: admin.id, email: admin.email }, process.env.SESSION_SECRET, { expiresIn: '7d' });
        res.setHeader('Set-Cookie', `dl_admin=${token}; HttpOnly; Secure; Path=/; Max-Age=604800; SameSite=Lax`);
        return res.status(200).json({ success: true });

    } catch (e) {
        console.error('Admin login error:', e);
        return res.status(500).json({ error: 'ডিবাগ এরর: ' + e.message });
    }
                               }
