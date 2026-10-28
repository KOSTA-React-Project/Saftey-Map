// 화면의 camelCase와 DB의 snake_case 변환은 이 파일에서만 처리한다.
const columns = `CAST(notes.id AS CHAR) AS id,
  notes.author_id AS authorId, notes.title, notes.content, notes.tag,
  DATE_FORMAT(notes.observed_date, '%Y-%m-%d') AS observedDate,
  notes.location_name AS locationName, notes.latitude, notes.longitude, notes.status,
  notes.moderation_reason AS moderationReason, notes.created_at AS createdAt, notes.updated_at AS updatedAt`

export function createMysqlNotes(pool) {
  return {
    async create(note) {
      const [result] = await pool.execute(
        `INSERT INTO notes (author_id, title, content, tag, observed_date,
          location_name, latitude, longitude, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [
          note.authorId,
          note.title,
          note.content,
          note.tag,
          note.observedDate,
          note.locationName,
          note.latitude,
          note.longitude,
        ],
      )
      return {
        id: String(result.insertId),
        status: 'PENDING',
      }
    },
    async listApproved() {
      const [rows] =
        await pool.execute(`SELECT CAST(id AS CHAR) AS id, title, tag, latitude, longitude
        FROM notes WHERE status = 'APPROVED' ORDER BY created_at DESC, id DESC`)
      return rows
    },
    async findApproved(id) {
      const [rows] = await pool.execute(
        `SELECT ${columns} FROM notes WHERE id = ? AND status = 'APPROVED'`,
        [id],
      )
      return rows[0]
    },
    async listForAdmin({ status, query, tag, page, pageSize }) {
      const conditions = []
      const values = []
      if (status) {
        conditions.push('status = ?')
        values.push(status)
      }
      if (tag) {
        conditions.push('tag = ?')
        values.push(tag)
      }
      if (query) {
        conditions.push('(LOCATE(?, title) > 0 OR LOCATE(?, content) > 0)')
        values.push(query, query)
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
      const [totals] = await pool.execute(
        `SELECT COUNT(*) AS total FROM notes ${where}`,
        values,
      )
      const total = Number(totals[0].total)
      const totalPages = Math.max(1, Math.ceil(total / pageSize))
      const currentPage = Math.min(page, totalPages)
      // 검증된 정수도 바인딩하며, LIMIT은 mysql2 query의 숫자 이스케이프를 사용한다.
      const [items] = await pool.query(
        `SELECT ${columns}, users.email AS authorEmail, users.nickname AS authorNickname
         FROM notes LEFT JOIN users ON users.id = notes.author_id ${where}
         ORDER BY notes.created_at DESC, notes.id DESC LIMIT ? OFFSET ?`,
        [...values, pageSize, (currentPage - 1) * pageSize],
      )
      const [groups] = await pool.execute(
        'SELECT status, COUNT(*) AS count FROM notes GROUP BY status',
      )
      const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0, HIDDEN: 0 }
      for (const group of groups) counts[group.status] = Number(group.count)
      return { items, total, page: currentPage, pageSize, totalPages, counts }
    },
    async findForAdmin(id) {
      const [rows] = await pool.execute(
        `SELECT ${columns} FROM notes WHERE id = ?`,
        [id],
      )
      return rows[0]
    },
    async setStatus(id, status, reason, previousStatus) {
      const [result] = await pool.execute(
        `UPDATE notes SET status = ?,
        moderation_reason = ?, updated_at = CURRENT_TIMESTAMP(3)
        WHERE id = ? AND status = ?`,
        [status, reason, id, previousStatus],
      )
      return result.affectedRows === 1
    },
  }
}
