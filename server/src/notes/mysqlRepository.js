// 화면의 camelCase와 DB의 snake_case 변환은 이 파일에서만 처리한다.
const columns = `id, author_id AS authorId, title, content, tag,
  DATE_FORMAT(observed_date, '%Y-%m-%d') AS observedDate,
  location_name AS locationName, latitude, longitude, status,
  moderation_reason AS moderationReason, created_at AS createdAt, updated_at AS updatedAt`

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
      return { id: result.insertId, status: 'PENDING' }
    },
    async listApproved() {
      const [rows] =
        await pool.execute(`SELECT id, title, tag, latitude, longitude
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
    async listForAdmin(status) {
      const [rows] = await pool.execute(
        `SELECT ${columns} FROM notes
        ${status ? 'WHERE status = ?' : ''} ORDER BY created_at DESC, id DESC`,
        status ? [status] : [],
      )
      return rows
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
        [status, reason || null, id, previousStatus],
      )
      return result.affectedRows === 1
    },
  }
}
