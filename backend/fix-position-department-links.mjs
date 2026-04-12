import pkg from 'pg';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getDatabaseConnectionString } from './src/config/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const { Pool } = pkg;
const pool = new Pool({ connectionString: getDatabaseConnectionString() });

const isApplyMode = process.argv.includes('--apply');
const FALLBACK_DEPARTMENT_NAME = 'Legacy / Unmapped';

async function ensureFallbackDepartment(createIfMissing = false) {
  const existing = await pool.query(
    'SELECT id, name FROM departments WHERE LOWER(name) = LOWER($1) LIMIT 1',
    [FALLBACK_DEPARTMENT_NAME]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  if (!createIfMissing) {
    return { id: null, name: FALLBACK_DEPARTMENT_NAME };
  }

  const created = await pool.query(
    'INSERT INTO departments (name, description) VALUES ($1, $2) RETURNING id, name',
    [FALLBACK_DEPARTMENT_NAME, 'Auto-created for legacy positions with unknown department mapping']
  );

  return created.rows[0];
}

async function fetchCandidates() {
  const sql = `
    WITH employee_position_dept AS (
      SELECT
        e.position AS position_name,
        COALESCE(e.department_id, d_text.id) AS inferred_department_id,
        COUNT(*)::INT AS usage_count
      FROM employees e
      LEFT JOIN departments d_text
        ON e.department_id IS NULL
       AND e.department IS NOT NULL
       AND LOWER(TRIM(e.department)) = LOWER(TRIM(d_text.name))
      WHERE e.position IS NOT NULL
        AND TRIM(e.position) <> ''
        AND COALESCE(e.department_id, d_text.id) IS NOT NULL
      GROUP BY e.position, COALESCE(e.department_id, d_text.id)
    ),
    best_department AS (
      SELECT DISTINCT ON (position_name)
        position_name,
        inferred_department_id,
        usage_count
      FROM employee_position_dept
      ORDER BY position_name, usage_count DESC
    )
    SELECT
      p.id,
      p.name,
      p.department_id AS current_department_id,
      d_current.name AS current_department_name,
      b.inferred_department_id,
      d_new.name AS inferred_department_name,
      b.usage_count,
      CASE
        WHEN b.inferred_department_id IS NOT NULL THEN 'employee-majority'
        WHEN d_current.id IS NULL THEN 'fallback-unmapped'
        ELSE 'unknown'
      END AS reason
    FROM positions p
    LEFT JOIN best_department b
      ON LOWER(TRIM(p.name)) = LOWER(TRIM(b.position_name))
    LEFT JOIN departments d_current
      ON d_current.id = p.department_id
    LEFT JOIN departments d_new
      ON d_new.id = b.inferred_department_id
    WHERE (b.inferred_department_id IS NOT NULL AND p.department_id IS DISTINCT FROM b.inferred_department_id)
       OR d_current.id IS NULL
    ORDER BY COALESCE(b.usage_count, 0) DESC, p.name;
  `;

  const { rows } = await pool.query(sql);
  return rows;
}

function planUpdates(rows, fallbackDepartmentId) {
  return rows.map((row) => ({
    ...row,
    target_department_id: row.inferred_department_id || fallbackDepartmentId || null,
  }));
}

async function applyFix(rows) {
  let updated = 0;

  for (const row of rows) {
    await pool.query(
      'UPDATE positions SET department_id = $1, updated_at = NOW() WHERE id = $2',
      [row.target_department_id, row.id]
    );
    updated += 1;
  }

  return updated;
}

async function main() {
  console.log('🔧 Position-Department Link Repair');
  console.log(`Mode: ${isApplyMode ? 'APPLY' : 'DRY-RUN'}`);

  const fallbackDepartment = await ensureFallbackDepartment(isApplyMode);
  const candidates = await fetchCandidates();
  const updates = planUpdates(candidates, fallbackDepartment.id);

  if (updates.length === 0) {
    console.log('✅ No mismatched position links found.');
    return;
  }

  console.log(`\nFound ${updates.length} candidate(s):`);
  for (const row of updates) {
    console.log(
      `- ${row.name} (${row.id})\n` +
      `  current: ${row.current_department_name || 'NULL'} (${row.current_department_id || 'NULL'})\n` +
      `  inferred: ${row.inferred_department_name || fallbackDepartment.name} (${row.target_department_id || 'will-create-on-apply'})\n` +
      `  support: ${row.usage_count || 0} employee row(s)\n` +
      `  reason: ${row.reason}`
    );
  }

  if (!isApplyMode) {
    console.log(`\nℹ️ Dry-run only. Re-run with --apply to update database.`);
    return;
  }

  const updated = await applyFix(updates);
  console.log(`\n✅ Updated ${updated} position record(s).`);
}

main()
  .catch((error) => {
    console.error('❌ Failed to repair links:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
