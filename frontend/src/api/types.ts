import type { components } from './schema'

type Schemas = components['schemas']

/**
 * docs/openapi.yaml no declara `required` en los schemas de respuesta, por lo que
 * openapi-typescript genera todos sus campos como opcionales aunque la API siempre los
 * envíe. `Complete` los vuelve obligatorios y conserva `| null` donde el contrato lo
 * declara (nullable). Es un ajuste de tipos, no una validación en tiempo de ejecución:
 * la forma general de las respuestas se comprueba en los servicios de cada feature.
 *
 * Si el contrato agrega `required`, este helper deja de ser necesario.
 */
export type Complete<T> = T extends readonly (infer U)[]
  ? Complete<U>[]
  : T extends object
    ? { [K in keyof T]-?: Complete<T[K]> }
    : T

// Los nombres son los de los schemas del contrato (docs/openapi.yaml).

// Enumeraciones
export type Rol = Schemas['Rol']
export type Tenencia = Schemas['Tenencia']
export type Protocolo = Schemas['Protocolo']
export type FuenteKm = Schemas['FuenteKm']
export type EstadoDispositivo = Schemas['EstadoDispositivo']
export type EstadoPlan = Schemas['EstadoPlan']
export type MotivoPostergacion = Schemas['MotivoPostergacion']

// Respuestas
export type Me = Complete<Schemas['Me']>
export type UnidadResumen = Complete<Schemas['UnidadResumen']>
export type DetalleUnidad = Complete<Schemas['DetalleUnidad']>
