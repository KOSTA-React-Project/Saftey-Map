export function memoryRepository() {
  const notes = []
  return {
    notes,
    async create(input) {
      const note = {
        ...input,
        id: notes.length + 1,
        status: 'PENDING',
        moderationReason: null,
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
    async listForAdmin(status) {
      return notes.filter((n) => !status || n.status === status)
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
