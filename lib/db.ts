import { config } from 'dotenv';
import { Pool, types } from 'pg';

// Standalone scripts (tsx) don't get .env.local loaded automatically the way Next.js
// does for API routes — load it here so every consumer of `sql` works either way.
config({ path: '.env.local' });

// pg's default parser for `timestamp without time zone` (OID 1114) constructs a JS
// Date using the Node process's LOCAL timezone, not UTC — so a stored UTC value like
// "2026-08-18 19:54:14" round-trips through toISOString() shifted by the machine's
// UTC offset. The session timezone here is UTC, so the raw string IS the correct UTC
// wall-clock value; return it unparsed and let callers attach 'Z' themselves.
types.setTypeParser(1114, (value) => value);

// This project's Postgres is ClickHouse Cloud's bundled Postgres service, not Neon —
// it speaks the plain wire protocol over TCP, not Neon's HTTP proxy, so we use `pg`
// directly. `sslmode` in the URL forces full CA-chain verification, which this host's
// cert doesn't satisfy, so it's stripped and verification is relaxed explicitly instead.
const url = new URL(process.env.DATABASE_URL!);
url.searchParams.delete('sslmode');

const pool = new Pool({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: false },
});

// Pairs with the OID 1114 override above: turns the raw "YYYY-MM-DD HH:MM:SS.sss"
// string Postgres returns back into a proper UTC ISO string for API responses.
export function pgTimestampToIso(raw: string): string {
  return raw.replace(' ', 'T') + 'Z';
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) {
    text += `$${i + 1}${strings[i + 1]}`;
  }
  return pool.query(text, values).then((result) => result.rows);
}
