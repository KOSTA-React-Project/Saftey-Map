export const TEST_USER_ID = '11111111-1111-4111-8111-111111111111'

export const TEST_ADMIN_ID = '22222222-2222-4222-8222-222222222222'

export function memoryRepository() {
  const notes = []
  return {
    notes,
    async create(input) {
      const note = {
        ...input,
        id: String(notes.length + 1),
        status: 'PENDING',
        moderationReason: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      notes.push(note)
      return { id: note.id, status: note.status }
    },
    async listApproved() {
      return notes.filter((n) => n.status === 'APPROVED')
    },
    async findApproved(id) {
      return notes.find((n) => n.id === id && n.status === 'APPROVED')
    },
    async listForAdmin({ status, query, tag, page, pageSize }) {
      const filtered = notes
        .filter(
          (n) =>
            (!status || n.status === status) &&
            (!tag || n.tag === tag) &&
            (!query ||
              `${n.title} ${n.content}`
                .toLocaleLowerCase()
                .includes(query.toLocaleLowerCase())),
        )
        .sort(
          (a, b) =>
            b.createdAt.localeCompare(a.createdAt) ||
            (BigInt(a.id) > BigInt(b.id) ? -1 : 1),
        )
      const total = filtered.length
      const totalPages = Math.max(1, Math.ceil(total / pageSize))
      const currentPage = Math.min(page, totalPages)
      const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0, HIDDEN: 0 }
      for (const note of notes) counts[note.status]++
      return {
        items: filtered.slice(
          (currentPage - 1) * pageSize,
          currentPage * pageSize,
        ),
        total,
        page: currentPage,
        pageSize,
        totalPages,
        counts,
      }
    },
    async findForAdmin(id) {
      return notes.find((n) => n.id === id)
    },
    async setStatus(id, status, reason, previousStatus) {
      const note = notes.find((n) => n.id === id && n.status === previousStatus)
      if (!note) return false
      Object.assign(note, {
        status,
        moderationReason: reason,
        updatedAt: new Date().toISOString(),
      })
      return true
    },
  }
}

export const validInput = {
  title: '보행로 관찰',
  tag: '조명 고장',
  content: '저녁에 가로등이 꺼져 있었어요.',
  observedDate: '2026-01-01',
  latitude: 37.5665,
  longitude: 126.978,
  locationName: '서울시 중구',
  agreed: true,
}
