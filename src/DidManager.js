import bip39 from 'bip39'
import { HDNode } from 'ethers'
import { createJWT, verifyJWT, SimpleSigner } from 'did-jwt'
import { REGISTRY, delegateTypes } from 'ethr-did-resolver'
import DidRegistryABI from 'ethr-did-resolver/contracts/ethr-did-registry.json'

import TransactionManager from 'TransactionManager'
import { didMethod, publicKeyToEthereumAddress, addressFromDid, privateKeyToEthereumAddress } from "./formatting";

const { Secp256k1VerificationKey2018 } = delegateTypes

export default class DidManager {

  static generateKeypair() {
    const keypair = secp256k1.genKeyPair()
    const publicKeyHex = keypair.getPublic('hex')
    const privateKeyHex = keypair.getPrivate('hex')
    return { publicKeyHex, privateKeyHex }
  }

  static generateDID = (conf = {}) => {
    let result = { hierarchy: !!conf.hierarchy }

    if (!conf.hierarchy) {
      // const keypair = secp256k1.genKeyPair()
      // result.publicKeyHex = keypair.getPublic('hex')
      // result.privateKeyHex = keypair.getPrivate('hex')

      const { publicKeyHex, privateKeyHex } = DidManager.generateKeypair()
      result = { ...result, publicKeyHex, privateKeyHex }

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

  constructor(conf) {
    if (!conf.rpcUrl) throw new Error (`Provided RPC URL is '${conf.rpcUrl}'`)

    this.ethInstance = new Eth(new HttpProvider(conf.rpcUrl))
    this.donatorAddress = conf.donatorAddress || ''

    this.didRegistryAddress = conf.didRegistryAddress || REGISTRY
    this.didRegistryInstance = new EthContract(this.ethInstance)(DidRegistryABI).at(this.didRegistryAddress)

    this.TransactionManager = new TransactionManager(this.ethInstance, REGISTRY, DidRegistryABI)
  }

  async lookupOwner(did) {
    const result = await this.didRegistryInstance.identityOwner(addressFromDid(did))
    return result['0']
  }

  async changeDidOwner(privateKey, did, newOwner) {
    const owner = this.lookupOwner(did)

    if(owner !== privateKeyToEthereumAddress(privateKey)) throw new Error(`You are not the owner of ${did}`)

    const rawTx = this.TransactionManager.changeOwnerTx(addressFromDid(did), newOwner, { from: owner })

    const txStatus = await this.sendFunds(rawTx)

    if(!txStatus) throw new Error('Funding transaction failed')

    const signedTx =  await this.TransactionManager.signTx(privateKey, rawTx)

    return await this.ethInstance.sendRawTransaction(signedTx)
  }

  async setAttribute(privateKey, did, key, value, expiresIn = 86400) {
    const owner = this.lookupOwner(did)

    if(owner !== privateKeyToEthereumAddress(privateKey)) throw new Error(`You are not the owner of ${did}`)

    const rawTx = this.TransactionManager.setAttributeTx(addressFromDid(did), key, value, expiresIn, { from: owner })

    const txStatus = await this.sendFunds(rawTx)

    if(!txStatus) throw new Error('Funding transaction failed')

    const signedTx =  await this.TransactionManager.signTx(privateKey, rawTx)

    return await this.ethInstance.sendRawTransaction(signedTx)
  }

  async setServiceEndpoint(privateKey, did, name, value, expiresIn = 86400) {
    return await this.setAttribute({ privateKey }, did, `did/svc/${name}`, value, expiresIn)
  }

  async addDelegate(privateKey, did, delegate, delegateType = Secp256k1VerificationKey2018, expiresIn = 86400) {
    const owner = this.lookupOwner(did)

    if(owner !== privateKeyToEthereumAddress(privateKey)) throw new Error(`You are not the owner of ${did}`)

    const rawTx = this.TransactionManager.addDelegateTx(addressFromDid(did), delegate, delegateType, expiresIn, { from: owner })

    const txStatus = await this.sendFunds(rawTx)

    if(!txStatus) throw new Error('Funding transaction failed')

    const signedTx =  await this.TransactionManager.signTx(privateKey, rawTx)

    return await this.ethInstance.sendRawTransaction(signedTx)
  }

  async createSigningDelegate (privateKey, did, delegateType = Secp256k1VerificationKey2018, expiresIn = 86400) {
    const keypair = DidManager.generateKeypair()
    const delegate = publicKeyToEthereumAddress(keypair.publicKeyHex)

    const txHash = await this.addDelegate(
      { privateKey },
      did,
      delegate,
      delegateType,
      expiresIn
    )

    return { keypair, txHash }
  }

  async signJWT(privateKey, payload, { issuer, audience = undefined, expiresIn = 86400 }) {
    const owner = this.lookupOwner(issuer)

    if(owner !== privateKeyToEthereumAddress(privateKey)) {
      throw new Error(`You are not the owner of provided issuer did ${issuer}`)
    }

    return createJWT(
      payload,
      { 
        alg: 'ES256K-R',
        signer: SimpleSigner(privateKey.slice(2)),
        issuer,
        audience, 
        expiresIn
      }
    )
  }

  async verifyJWT(jwt, audience = undefined) {
    return verifyJWT(jwt, { audience })
  }
}
