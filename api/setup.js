import { sql } from "../lib/db.js";

export default async function handler(req, res) {
  try {

    await sql`
      CREATE TABLE IF NOT EXISTS analytics (
        id SERIAL PRIMARY KEY,
        ip TEXT,
        dream TEXT,
        religion TEXT,
        tokens INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    res.status(200).json({
      success: true,
      message: "Analytics table created"
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }
}
