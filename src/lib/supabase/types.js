/**
 * @template T
 * @typedef {{ ok: true, data: T } | { ok: false, error: AppError }} ServiceResult
 */

/**
 * @typedef {Object} AppError
 * @property {string} code
 * @property {string} message
 * @property {unknown=} cause
 */

export {};
