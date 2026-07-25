// ── lib/adminAuth.js ───────────────────────────────────────
import jwt from 'jsonwebtoken';

// প্রতিটা admin API endpoint-এর শুরুতে এটা কল করবেন — cookie যাচাই করে admin কিনা নিশ্চিত করে
export function requireAdmin(req) {
    const cookie = req.headers.cookie || '';
    const match = cookie.match(/dl_admin=([^;]+)/);
    if (!match) throw new Error('UNAUTHORIZED');

    try {
        return jwt.verify(match[1], process.env.SESSION_SECRET);
    } catch (e) {
        throw new Error('UNAUTHORIZED');
    }
}
