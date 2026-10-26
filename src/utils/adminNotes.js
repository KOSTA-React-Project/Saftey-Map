export const ADMIN_STATUS_LABELS = {
  PENDING: '승인 대기',
  APPROVED: '게시 승인',
  REJECTED: '반려',
  HIDDEN: '숨김',
}

export function filterAdminNotes(
  notes,
  { query = '', status = 'PENDING', tag = '' } = {},
) {
  const text = query.trim().slice(0, 80).toLocaleLowerCase()
  return notes
    .filter(
      (note) =>
        (!status || note.status === status) &&
        (!tag || note.tag === tag) &&
        (!text ||
          `${note.title} ${note.content}`.toLocaleLowerCase().includes(text)),
    )
    .sort(
      (a, b) =>
        String(b.createdAt).localeCompare(String(a.createdAt)) || b.id - a.id,
    )
}

export function getModerationHistory(notes) {
  return notes
    .flatMap((note) =>
      (note.moderationHistory ?? []).map((entry) => ({
        ...entry,
        noteId: note.id,
        title: note.title,
      })),
    )
    .sort((a, b) => b.processedAt.localeCompare(a.processedAt))
}
