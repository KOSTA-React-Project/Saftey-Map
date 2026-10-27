export const initialCompareState = {
  A: null,
  B: null,
  editing: null,
  lastSelected: null,
  radius: 1000,
  revision: 0,
  status: 'idle',
  result: null,
  error: '',
}

export function isValidPosition(point) {
  return Boolean(
    point &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180,
  )
}

export function compareReducer(state, action) {
  switch (action.type) {
    case 'edit':
      return {
        ...state,
        editing: action.slot,
        status: state.status === 'loading' ? 'idle' : state.status,
      }
    case 'select': {
      if (!isValidPosition(action.position)) return state
      const slot =
        action.slot ?? state.editing ?? (state.lastSelected === 'A' ? 'B' : 'A')
      if (!['A', 'B'].includes(slot)) return state
      return {
        ...state,
        [slot]: action.position,
        lastSelected: slot,
        editing: null,
        revision: state.revision + 1,
        status: 'idle',
        result: null,
        error: '',
      }
    }
    case 'address':
      if (
        !state[action.slot] ||
        state[action.slot].selectionId !== action.selectionId
      )
        return state
      return {
        ...state,
        [action.slot]: { ...state[action.slot], address: action.address },
      }
    case 'radius':
      if (![500, 1000].includes(action.radius)) return state
      return {
        ...state,
        radius: action.radius,
        revision: state.revision + 1,
        status: 'idle',
        result: null,
        error: '',
      }
    case 'reset':
      return { ...initialCompareState, revision: state.revision + 1 }
    case 'start':
      return {
        ...state,
        requestId: action.requestId,
        status: 'loading',
        error: '',
        result: null,
      }
    case 'success':
      if (
        action.revision !== state.revision ||
        action.requestId !== state.requestId
      )
        return state
      return { ...state, status: 'ready', result: action.result }
    case 'failure':
      if (
        action.revision !== state.revision ||
        action.requestId !== state.requestId
      )
        return state
      return { ...state, status: 'error', result: null, error: action.error }
    case 'close':
      return { ...state, status: 'idle', result: null }
    default:
      return state
  }
}
