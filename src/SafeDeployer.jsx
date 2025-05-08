import React, { useState } from 'react'
import { createSmartAccountClient } from 'permissionless'
import {
   createPublicClient,
   createWalletClient,
   custom,
   http,
   zeroAddress
 } from 'viem'

/* ----------  Rootstock test‑net chain definition ---------- */
const rootstockTestnet = {
  id: 31,
  name: 'Rootstock Testnet',
  nativeCurrency: { name: 'tRBTC', symbol: 'tRBTC', decimals: 18 },
  rpcUrls: { default: { http: ['https://public-node.testnet.rsk.co'] } },
  blockExplorers: {
    default: { name: 'RSK Explorer', url: 'https://explorer.testnet.rsk.co' }
  }
}

/* ----------  Pimlico bundler URL (replace API‑KEY!) ---------- */
const BUNDLER_URL =
  'https://api.pimlico.io/v1/rsk-testnet/rpc?apikey=YOUR_PIMLICO_KEY'

export default function SafeDeployer () {
  const [status, setStatus] = useState('Idle')
  const [safeAddress, setSafeAddress] = useState('')

  const deploySafe = async () => {
    try {
      setStatus('Connecting wallet …')
      if (!window.ethereum) {
        setStatus('❌ MetaMask not detected')
        return
      }

      /* request connect */
      await window.ethereum.request({ method: 'eth_requestAccounts' })

      /* viem walletClient wrapping MetaMask */
      const walletClient = createWalletClient({
        transport: custom(window.ethereum),
        chain: rootstockTestnet
      })

      /* convert to AA‑signer */
      const signer = walletClient

      /* public client for reads */
      const publicClient = createPublicClient({
        chain: rootstockTestnet,
        transport: http('https://public-node.testnet.rsk.co')
      })

      /* smart‑account client (Safe 1‑of‑1 behind the scenes) */
      const smartAccountClient = createSmartAccountClient({
        account: {
          type: 'SAFE',
          owners: [await walletClient.getAddresses().then(a => a[0])],
          threshold: 1,
          version: '1.4.1'
        },
        chain: rootstockTestnet,
        publicClient,
        bundlerTransport: http(BUNDLER_URL),
        signer
      })

      const addr = await smartAccountClient.getAddress()
      setSafeAddress(addr)
      setStatus(`Smart account address: ${addr.slice(0, 10)}…`)

      /* send a dummy user‑op so the bundler deploys the account */
      setStatus('Sending deployment user‑op … check MetaMask')
      const uoHash = await smartAccountClient.sendTransaction({
        to: zeroAddress,
        value: 0n,
        data: '0x'
      })

      setStatus('Waiting for bundler …')
      await publicClient.waitForTransactionReceipt({ hash: uoHash })

      setStatus(`✅ Safe deployed at ${addr.slice(0, 10)}…`)
    } catch (err) {
      console.error(err)
      setStatus(`❌ Error: ${err.message}`)
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 600 }}>
      <h2>Safe Wallet Creator – Rootstock / permissionless.js</h2>
      <button onClick={deploySafe}>Create 1‑of‑1 Safe (ERC‑4337)</button>
      <p>Status: {status}</p>
      {safeAddress && (
        <p>
          Smart Account:&nbsp;
          <a
            href={`https://explorer.testnet.rsk.co/address/${safeAddress}`}
            target='_blank'
            rel='noopener noreferrer'
          >
            {safeAddress}
          </a>
        </p>
      )}
    </div>
  )
}