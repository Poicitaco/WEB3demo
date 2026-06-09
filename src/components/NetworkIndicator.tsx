"use client";

import { useEffect, useState } from 'react';
import type { Eip1193Provider } from 'ethers';

type EthereumProvider = Eip1193Provider & {
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

function getEthereum() {
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum;
}

function nameFromChainId(id: number) {
  switch (id) {
    case 1: return 'Ethereum Mainnet';
    case 11155111: return 'Sepolia';
    case 5: return 'Goerli';
    case 137: return 'Polygon';
    case 8453: return 'Base';
    default: return `Chain ${id}`;
  }
}

export default function NetworkIndicator() {
  const [label, setLabel] = useState<string>('');

  async function refresh() {
    try {
      const eth = getEthereum();
      if (!eth) { setLabel('No wallet'); return; }
      const chainIdHex = await eth.request?.({ method: 'eth_chainId' });
      const id = parseInt(chainIdHex as string, 16);
      setLabel(nameFromChainId(id));
    } catch { setLabel('Unknown network'); }
  }

  useEffect(() => {
    refresh();
    const eth = getEthereum();
    const onChain = () => refresh();
    eth?.on?.('chainChanged', onChain);
    return () => eth?.removeListener?.('chainChanged', onChain);
  }, []);

  if (!label) return null;
  return <span className="hidden sm:block text-xs muted">{label}</span>;
}

