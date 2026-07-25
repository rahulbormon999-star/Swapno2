// ── Neon (Postgres) কানেকশন হেল্পার — সব API ফাইল এটা import করবে ──
import { neon } from '@neondatabase/serverless';

// process.env.DATABASE_URL — Vercel environment variable-এ Neon-এর connection string বসাতে হবে
export const sql = neon(process.env.DATABASE_URL);

// উদাহরণ ব্যবহার: const rows = await sql`SELECT * FROM symbols WHERE category = ${category}`;
