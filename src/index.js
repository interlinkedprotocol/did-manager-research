import bip39 from 'bip39'
import { HDNode } from 'ethers'
import { ec as EC } from 'elliptic'

import EthrDID from './ethrDid'
import { didMethod, publicKeyToEthereumAddress } from './formatting'

const secp256k1 = new EC('secp256k1')

export function generateDID(conf = {}) {
  let result = {
    hierarchy: !!conf.hierarchy
  }

  if (!conf.hierarchy) {
    const keypair = secp256k1.genKeyPair()
    result.publicKeyHex = keypair.getPublic('hex')
    result.privateKeyHex = keypair.getPrivate('hex')
  } else {
    result.mnemonic = conf.mnemonic || bip39.generateMnemonic()

    const masterNode = HDNode.fromMnemonic(result.mnemonic)

    result.derivationPathRoot = conf.derivationPathRoot || `m/44'/60'/0'/0`
    result.index = conf.index || 0

    const addressNode = masterNode.derivePath(`${result.derivationPathRoot}/${result.index}`)

    result.publicKeyHex = addressNode.publicKey
    result.privateKeyHex = addressNode.privateKey
  }

  result.ethereumAddress = publicKeyToEthereumAddress(result.publicKeyHex)
  result.did = didMethod(result.ethereumAddress)

  return result
}

export async function setServiceEndpoint(did, privateKey, serviceName, serviceUrl) {
  const address = did.slice(9)

  const ethrDid = new EthrDID({

  })
  const rawTx = await currentAddressNode.ethrDid.setAttributeTx(this.attrKey.value, this.attrValue.value)
  const sendTxFunctions = await currentAddressNode.ethrDid.sendFundedTx(rawTx, 'setAttribute')
  await this.execSendTxSequence(sendTxFunctions)
}

export function getServiceEndpoints() {}

export function changeDIDOwner() {}

export function signDidJwt() {}

export function verifyDidJwt() {}
