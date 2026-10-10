import { apiGet } from '../../../api/client'
import { expectRecord, expectString } from '../../../api/guards'
import type { Me } from '../../../api/types'

/** GET /me — usuario actual. */
export const getCurrentUser = async (signal?: AbortSignal): Promise<Me> => {
  const raw = expectRecord(await apiGet<unknown>('/me', { signal }), 'GET /me')
  expectString(raw.email, 'GET /me › email')
  expectString(raw.rol, 'GET /me › rol')
  return raw as unknown as Me
}
