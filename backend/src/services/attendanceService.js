import { query } from '../config/db.js';

class AttendanceService {
  async createOne(record) {
    const sql = `
      INSERT INTO time_attendances (
        local_id,
        employee_id,
        person_name,
        card_number,
        department,
        access_datetime
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (employee_id, access_datetime) DO NOTHING
      RETURNING *
    `;

    const values = [
      record.local_id ?? null,
      record.employee_id,
      record.person_name ?? null,
      record.card_number ?? null,
      record.department ?? null,
      record.access_datetime,
    ];

    const result = await query(sql, values);
    if (result.rows[0]) {
      return result.rows[0];
    }

    const existing = await query(
      `
        SELECT *
        FROM time_attendances
        WHERE employee_id = $1
          AND access_datetime = $2
        ORDER BY id ASC
        LIMIT 1
      `,
      [record.employee_id, record.access_datetime]
    );

    return existing.rows[0] ?? null;
  }

  async createBulk(records) {
    if (!records.length) {
      return [];
    }

    const valuePlaceholders = records
      .map((_, index) => {
        const offset = index * 6;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
      })
      .join(', ');

    const values = records.flatMap((record) => [
      record.local_id ?? null,
      record.employee_id,
      record.person_name ?? null,
      record.card_number ?? null,
      record.department ?? null,
      record.access_datetime,
    ]);

    const sql = `
      INSERT INTO time_attendances (
        local_id,
        employee_id,
        person_name,
        card_number,
        department,
        access_datetime
      )
      VALUES ${valuePlaceholders}
      ON CONFLICT (employee_id, access_datetime) DO NOTHING
      RETURNING *
    `;

    const result = await query(sql, values);
    return result.rows;
  }
}

export default new AttendanceService();
