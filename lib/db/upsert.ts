import { getTableColumns, sql, type SQL } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

/** `set` for onConflictDoUpdate that overwrites every column with the incoming row. */
export function overwriteAll<T extends SQLiteTable>(table: T): Record<string, SQL> {
  return Object.fromEntries(
    Object.entries(getTableColumns(table)).map(([key, column]) => [key, sql.raw(`excluded."${column.name}"`)]),
  );
}
