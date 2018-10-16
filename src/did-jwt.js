export const extractClaims = (didJwt) => Object.entries(didJwt.payload).reduce((res, [key, value]) => isNaN(parseInt(key)) ? res : `${res}${value}`, '')
export const extractTimestamp = (didJwt) => didJwt.payload.iat
export const extractIssuerDid = (didJwt) => didJwt.payload.iss
