// ── /api/auth/callback.js ──────────────────────────────────
// Dev-Onix থেকে ইউজার এখানে ফিরে আসবে ?token=... সহ
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    try {
        const { sql } = await import('../../lib/db.js');
        const { token } = req.query;

        if (!token) {
            return res.status(400).send('টোকেন পাওয়া যায়নি।');
        }

        // Dev-Onix-এর পাঠানো JWT যাচাই করা হচ্ছে (দুই সাইটেই একই SHARED_SSO_SECRET থাকতে হবে)
        const payload = jwt.verify(token, process.env.SHARED_SSO_SECRET);

        const { user_id, name, phone, email, dob, gender, picture, country } = payload;
        if (!user_id) {
            return res.status(400).send('টোকেনে ইউজার আইডি নেই।');
        }

        // ইউজার আগে থেকে থাকলে আপডেট, না থাকলে নতুন তৈরি (upsert)
        const rows = await sql`
            INSERT INTO users (dev_onix_user_id, name, phone, email, dob, gender, picture, country, last_seen)
            VALUES (${user_id}, ${name}, ${phone}, ${email}, ${dob || null}, ${gender || null}, ${picture}, ${country}, now())
            ON CONFLICT (dev_onix_user_id)
            DO UPDATE SET
                name = EXCLUDED.name,
                phone = EXCLUDED.phone,
                email = EXCLUDED.email,
                dob = EXCLUDED.dob,
                gender = EXCLUDED.gender,
                picture = EXCLUDED.picture,
                country = EXCLUDED.country,
                last_seen = now()
            RETURNING id
        `;

        const dbUserId = rows[0].id;

        // ইউজারকে চেনার জন্য একটা নিজস্ব সেশন-টোকেন বানানো হচ্ছে (৩০ দিন বৈধ)
        const sessionToken = jwt.sign({ dbUserId }, process.env.SESSION_SECRET, { expiresIn: '30d' });

        res.setHeader('Set-Cookie', `dl_session=${sessionToken}; HttpOnly; Secure; Path=/; Max-Age=2592000; SameSite=Lax`);
        res.redirect(302, '/'); // মূল অ্যাপে ফিরিয়ে দেওয়া হচ্ছে

    } catch (e) {
        console.error('SSO callback error:', e);
        res.status(401).send('লগইন যাচাই ব্যর্থ হয়েছে: ' + e.message);
    }
}
