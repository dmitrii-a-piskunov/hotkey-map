/**
 * Источник id и времени для операций с данными (ТЗ, раздел 9.1): UUID и
 * дата ISO 8601. В тестах подменяется предсказуемым.
 */

export interface Clock {
  id(): string
  /** Текущее время в ISO 8601 */
  now(): string
}

export const systemClock: Clock = {
  id: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
}
