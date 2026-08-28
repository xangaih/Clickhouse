import { config } from 'dotenv';
import { createClient } from '@clickhouse/client';

// Standalone scripts (tsx) don't get .env.local loaded automatically the way Next.js
// does for API routes — load it here so every consumer of `clickhouse` works either way.
config({ path: '.env.local' });

export const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USER,
  password: process.env.CLICKHOUSE_PASSWORD,
  database: process.env.CLICKHOUSE_DATABASE ?? 'default',
});

export async function chQuery<T = unknown>(
  query: string,
  query_params?: Record<string, unknown>
): Promise<T[]> {
  const resultSet = await clickhouse.query({ query, query_params, format: 'JSONEachRow' });
  return resultSet.json<T>();
}
