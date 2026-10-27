import { Router } from 'express'
import { NOTE_STATUS, validateNote } from '../shared/notes.mjs'

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function idOf(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || Number(value) > 4294967295) {
    throw new HttpError(400, '노트 ID가 올바르지 않습니다.')
  }
  return Number(value)
}

function requireUser(req, res, next) {
  if (!req.user || !Number.isInteger(req.user.id) || req.user.id <= 0) {
    throw new HttpError(401, '로그인이 필요합니다.')
  }
  next()
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN')
    throw new HttpError(403, '관리자 권한이 필요합니다.')
  next()
}

const summary = (note) => ({
  id: note.id,
  title: note.title,
  tag: note.tag,
  latitude: Number(note.latitude),
  longitude: Number(note.longitude),
})

export function createNotesRouter({ repository, authenticate }) {
  const router = Router()
  router.get('/notes', async (req, res) => {
    res.json((await repository.listApproved()).map(summary))
  })
  router.get('/notes/:id', async (req, res) => {
    const note = await repository.findApproved(idOf(req.params.id))
    if (!note) throw new HttpError(404, '안심노트를 찾을 수 없습니다.')
    res.json({
      ...summary(note),
      content: note.content,
      observedDate: note.observedDate,
      locationName: note.locationName,
      createdAt: note.createdAt,
      status: note.status,
    })
  })
  router.post('/notes', authenticate, requireUser, async (req, res) => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    const errors = validateNote(req.body, { today })
    if (errors.length) throw new HttpError(400, errors.join(' '))
    const input = req.body
    const result = await repository.create({
      authorId: req.user.id,
      title: input.title.trim(),
      content: input.content.trim(),
      tag: input.tag.trim(),
      observedDate: input.observedDate,
      locationName: (input.locationName ?? '').trim(),
      latitude: Number(input.latitude),
      longitude: Number(input.longitude),
    })
    res.status(201).json(result)
  })
  router.get(
    '/admin/notes',
    authenticate,
    requireUser,
    requireAdmin,
    async (req, res) => {
      // status를 생략하면 기존 UI 계약대로 승인 대기, 빈 문자열이면 전체 목록.
      const status = req.query.status ?? NOTE_STATUS.PENDING
      if (status !== '' && !Object.values(NOTE_STATUS).includes(status))
        throw new HttpError(400, '조회 상태가 올바르지 않습니다.')
      res.json(await repository.listForAdmin(status || null))
    },
  )
  router.patch(
    '/admin/notes/:id/status',
    authenticate,
    requireUser,
    requireAdmin,
    async (req, res) => {
      const id = idOf(req.params.id)
      const { status, reason = '', expectedStatus } = req.body ?? {}
      if (
        !Object.values(NOTE_STATUS).includes(status) ||
        (expectedStatus != null &&
          !Object.values(NOTE_STATUS).includes(expectedStatus))
      ) {
        throw new HttpError(400, '처리 상태가 올바르지 않습니다.')
      }
      if (typeof reason !== 'string' || reason.trim().length > 500)
        throw new HttpError(400, '처리 사유는 500자 이하로 입력해 주세요.')
      if (
        [NOTE_STATUS.REJECTED, NOTE_STATUS.HIDDEN].includes(status) &&
        !reason.trim()
      ) {
        throw new HttpError(400, '반려·숨김 사유를 입력해 주세요.')
      }
      const note = await repository.findForAdmin(id)
      if (!note) throw new HttpError(404, '안심노트를 찾을 수 없습니다.')
      const transitions = {
        PENDING: ['APPROVED', 'REJECTED'],
        APPROVED: ['HIDDEN'],
        HIDDEN: ['APPROVED'],
        REJECTED: [],
      }
      if (
        (expectedStatus != null && expectedStatus !== note.status) ||
        !transitions[note.status]?.includes(status)
      ) {
        throw new HttpError(
          409,
          '이미 처리되었거나 현재 상태에서는 처리할 수 없습니다. 목록을 새로고침해 주세요.',
        )
      }
      // WHERE status 조건으로 두 관리자가 동시에 처리해도 먼저 처리한 결과를 보존한다.
      if (
        !(await repository.setStatus(id, status, reason.trim(), note.status))
      ) {
        throw new HttpError(
          409,
          '다른 관리자가 이미 처리했습니다. 목록을 새로고침해 주세요.',
        )
      }
      res.json({ id, status })
    },
  )
  return router
}
