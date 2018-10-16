import { ethInstance, /* etherscanBaseUrl */ } from '../connect'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
  
export async function waitBlock(txHash) {
  while (true) {
    try{
      const receipt = await ethInstance.getTransactionReceipt(txHash)
      return receipt.status === '0x1'
    } catch (e) {
      console.log(`Mining...`/* ${etherscanBaseUrl}/${txHash} */)
      await sleep(4000);
    }
  }
}
