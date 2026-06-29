import { sql } from "@vercel/postgres";

export async function testDB() {
  const result = await sql`SELECT NOW()`;
  return result.rows;
}
