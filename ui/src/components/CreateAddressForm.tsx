import { useState } from 'react';
import type { Address } from '../App';

interface Props {
  onCreated: (addr: Address) => void;
}

const API_BASE = '/api';

export function CreateAddressForm({ onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    userId: '',
    depositChain: 'btc',
    destinationChain: 'eth',
    destinationAsset: 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
    recipient: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create address');
      }

      const addr = await res.json();
      onCreated(addr);
      setForm((prev) => ({ ...prev, userId: '', recipient: '' }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const presets = [
    { label: 'BTC → USDC (ETH)', depositChain: 'btc', destinationChain: 'eth', asset: 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near' },
    { label: 'ETH → USDC (Base)', depositChain: 'evm', destinationChain: 'base', asset: 'nep141:base-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near' },
    { label: 'SOL → USDT (ETH)', depositChain: 'sol', destinationChain: 'eth', asset: 'nep141:eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near' },
  ];

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="px-4 py-3 border-b border-gray-700">
        <h2 className="font-semibold">Create Address</h2>
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Preset</label>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    depositChain: p.depositChain,
                    destinationChain: p.destinationChain,
                    destinationAsset: p.asset,
                  }))
                }
                className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">User ID</label>
          <input
            type="text"
            value={form.userId}
            onChange={(e) => setForm((prev) => ({ ...prev, userId: e.target.value }))}
            placeholder="user-123"
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Deposit Chain</label>
            <select
              value={form.depositChain}
              onChange={(e) => setForm((prev) => ({ ...prev, depositChain: e.target.value }))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            >
              <option value="btc">BTC</option>
              <option value="evm">EVM (any)</option>
              <option value="sol">Solana</option>
              <option value="tron">Tron</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Destination Chain</label>
            <select
              value={form.destinationChain}
              onChange={(e) => setForm((prev) => ({ ...prev, destinationChain: e.target.value }))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            >
              <option value="eth">Ethereum</option>
              <option value="base">Base</option>
              <option value="arb">Arbitrum</option>
              <option value="near">NEAR</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Destination Asset</label>
          <input
            type="text"
            value={form.destinationAsset}
            onChange={(e) => setForm((prev) => ({ ...prev, destinationAsset: e.target.value }))}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm font-mono text-xs"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Recipient Address</label>
          <input
            type="text"
            value={form.recipient}
            onChange={(e) => setForm((prev) => ({ ...prev, recipient: e.target.value }))}
            placeholder="0x..."
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm font-mono"
            required
          />
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded px-3 py-2 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded font-medium"
        >
          {loading ? 'Creating...' : 'Create Address'}
        </button>
      </form>
    </div>
  );
}
