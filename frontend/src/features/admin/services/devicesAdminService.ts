import { apiGet, apiPatch, apiPost } from '../../../api/client'
import { expectArray, expectRecord, expectString } from '../../../api/guards'
import type { Device } from '../types'

const checkDevice = (raw: unknown, where: string): Device => {
  const device = expectRecord(raw, where)
  expectString(device.device_uid, `${where} › device_uid`)
  return device as unknown as Device
}

/** GET /dispositivos — todos, con su unidad vinculada si tienen (RF03). El listado no es paginado. */
export const getDevices = async (signal?: AbortSignal): Promise<Device[]> => {
  const body = expectRecord(await apiGet<unknown>('/dispositivos', { signal }), 'GET /dispositivos')
  return expectArray(body.data, 'GET /dispositivos › data').map((item, index) =>
    checkDevice(item, `GET /dispositivos › data[${index}]`),
  )
}

/** POST /dispositivos — alta (RF03). Nace inactivo y sin vincular. */
export const createDevice = async (deviceUid: string, signal?: AbortSignal): Promise<Device> =>
  checkDevice(
    await apiPost<unknown>('/dispositivos', { body: { device_uid: deviceUid }, signal }),
    'POST /dispositivos',
  )

/** PATCH /dispositivos/{device_uid}/vincular — vincula a una unidad (RN02). 409 si alguno está ocupado. */
export const linkDevice = async (deviceUid: string, patente: string, signal?: AbortSignal): Promise<Device> =>
  checkDevice(
    await apiPatch<unknown>('/dispositivos/{device_uid}/vincular', {
      pathParams: { device_uid: deviceUid },
      body: { patente },
      signal,
    }),
    'PATCH /dispositivos/{device_uid}/vincular',
  )

/** PATCH /dispositivos/{device_uid}/desvincular — lo desvincula de su unidad y queda inactivo. */
export const unlinkDevice = async (deviceUid: string, signal?: AbortSignal): Promise<Device> =>
  checkDevice(
    await apiPatch<unknown>('/dispositivos/{device_uid}/desvincular', {
      pathParams: { device_uid: deviceUid },
      signal,
    }),
    'PATCH /dispositivos/{device_uid}/desvincular',
  )
