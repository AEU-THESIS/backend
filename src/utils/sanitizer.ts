/**
 * Recursively redacts sensitive fields from an object.
 * Returns a new object and does not mutate the original.
 */
export const redactSensitiveFields = (obj: any): any => {
  if (!obj || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveFields)
  }

  const sensitiveKeys = [
    'password',
    'pass',
    'pwd',
    'token',
    'resetToken',
    'authToken',
    'email',
    'phone',
    'ssn',
    'address',
    'creditCard',
    'cardNumber',
    'pinCode',
  ]

  const redacted: any = {}

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
        redacted[key] = '[REDACTED]'
      } else if (typeof obj[key] === 'object') {
        redacted[key] = redactSensitiveFields(obj[key])
      } else {
        redacted[key] = obj[key]
      }
    }
  }

  return redacted
}
