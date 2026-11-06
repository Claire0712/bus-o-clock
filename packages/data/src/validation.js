export class DataError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'DataError';
    this.code = code;
  }
}

export function requireValue(condition, message) {
  if (!condition) throw new DataError('INVALID_INPUT', message);
}

export function validateSelection(value) {
  requireValue(value && /^[A-F0-9]{16}$/.test(value.stopId), 'A valid KMB stopId is required.');
  requireValue(typeof value.route === 'string' && /^[A-Z0-9]{1,12}$/.test(value.route), 'A valid uppercase route is required.');
  requireValue(['O', 'I'].includes(value.direction), 'direction must be O or I.');
  requireValue(typeof value.serviceType === 'string' && /^[1-9]\d*$/.test(value.serviceType), 'serviceType must be a positive integer string.');
  requireValue(Number.isInteger(value.stopSequence) && value.stopSequence > 0, 'stopSequence must be a positive integer.');
}

export function validateCommute(value) {
  validateSelection(value);
  for (const field of ['walkMinutes', 'bufferMinutes']) {
    requireValue(Number.isFinite(value[field]) && value[field] >= 0 && value[field] <= 180, `${field} must be a number from 0 to 180.`);
  }
}

export function validatePoint(point) {
  requireValue(point && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180, 'Valid numeric latitude and longitude are required.');
}

export function names(record, prefix) {
  return { en: record[`${prefix}_en`] ?? '', tc: record[`${prefix}_tc`] ?? '', sc: record[`${prefix}_sc`] ?? '' };
}
