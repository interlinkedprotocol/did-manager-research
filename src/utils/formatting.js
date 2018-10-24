import { Buffer } from 'buffer'
import { privateToAddress, pubToAddress, toBuffer } from 'ethereumjs-util'

export const addressFromDid = did => did.slice(9)

export const didMethod = ethereumAddress => `did:ethr:${ethereumAddress}`

export const privateKeyToEthereumAddress = privateKeyHex => `0x${privateToAddress(`0x${privateKeyHex}`).toString('hex')}`

export const publicKeyToEthereumAddress = publicKeyHex => `0x${pubToAddress(`0x${publicKeyHex.slice(2)}`).toString('hex')}`

export const bytes32toString = bytes32 => toBuffer(bytes32).toString('utf8').replace(/\0+$/, '')

export function stringToBytes32(str) {
  const buffstr = `0x${toBuffer(str).slice(0, 32).toString('hex')}`
  return `${buffstr}${'0'.repeat(66 - buffstr.length)}`
}

export function attributeToHex (key, value) {
  if (Buffer.isBuffer(value)) return `0x${value.toString('hex')}`

  const match = key.match(/^did\/(pub|auth|svc)\/(\w+)(\/(\w+))?(\/(\w+))?$/)
  if (match) {
    const section = match[1]
    const encoding = match[6]
    switch (section) {
      case 'pub':
      case 'auth':
        switch (encoding) {
          case 'base64':
            return `0x${Buffer.from(value, 'base64').toString('hex')}`
          case 'hex':
          default:
            return value
        }
      case 'svc':
        return `0x${Buffer.from(value).toString('hex')}`
      default:
        throw new Error(`DID document section '${section}' is not defined`)
    }
  }

  if (value.match(/^0x[0-9a-fA-F]*$/)) return value

  return `0x${Buffer.from(value).toString('hex')}`
}
  
export function hexToAttribute(key, value) {
  const match = key.match(/^did\/(pub|auth|svc)\/(\w+)(\/(\w+))?(\/(\w+))?$/)
  if (match) {
    const section = match[1]
    const encoding = match[6]

    if (!value.match(/^0x[0-9a-fA-F]*$/)) throw new Error(`Provided value '${value}' is invalid HEX`)

    switch (section) {
      case 'pub':
      case 'auth': {
        switch (encoding) {
          case 'hex':
            return value.slice(2)
          case 'base64':
            return Buffer.from(value.slice(2), 'hex').toString('base64')
          default:
            return value
        }
      }
      case 'svc':
        return Buffer.from(value.slice(2), 'hex').toString()
      default:
        throw new Error(`DID document section '${section}' is not defined`)
    }
  }
  return value
}