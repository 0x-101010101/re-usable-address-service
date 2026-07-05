import { useState, useEffect, useCallback } from 'react';
import { AddressTable } from './components/AddressTable';
import { WithdrawalsPanel } from './components/WithdrawalsPanel';

export interface Address {
  id: number;
  userId: string;
  depositChain: string;
  destinationChain: string;
  destinationAsset: string;
  recipient: string;
  depositAddress: string;
  accountId: string;
  memo: string | null;
  createdAt: string;
  depositCount: number;
  lastDepositAt: string | null;
}

export interface UnifiedDeposit {
  status: 'DETECTED' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  depositTxHash: string;
  withdrawTxHash?: string;
  chain: string;
  amountIn: string;
  amountOut?: string;
  amountOutUsd?: string;
  detectedAt: string;
  completedAt?: string;
}

interface StatusResponse {
  address: Address;
  deposits: UnifiedDeposit[];
  summary: { detected: number; processing: number; success: number; failed: number };
  notes: string[];
}

const API_BASE = '/api';

export default function App() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [deposits, setDeposits] = useState<Record<number, UnifiedDeposit[]>>({});
  const [statusNotes, setStatusNotes] = useState<Record<number, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [pollInterval, setPollInterval] = useState(5);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchAddresses = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/addresses/all`);
      if (res.ok) {
        const data = await res.json();
        setAddresses(data.addresses || []);
      }
    } catch (err) {
      console.error('Failed to fetch addresses:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStatus = useCallback(async (addressId: number) => {
    try {
      const res = await fetch(`${API_BASE}/address/${addressId}/unified-status`);
      if (res.ok) {
        const data: StatusResponse = await res.json();
        setDeposits((prev) => ({ ...prev, [addressId]: data.deposits || [] }));
        setStatusNotes((prev) => ({ ...prev, [addressId]: data.notes || [] }));
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await fetchAddresses();
    for (const addr of addresses) {
      await fetchStatus(addr.id);
    }
    setLastUpdate(new Date());
  }, [fetchAddresses, fetchStatus, addresses]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  useEffect(() => {
    const interval = setInterval(() => refreshAll(), pollInterval * 1000);
    return () => clearInterval(interval);
  }, [pollInterval, refreshAll]);

  const getStatusSummary = (addressId: number) => {
    const deps = deposits[addressId] || [];
    return {
      total: deps.length,
      detected: deps.filter((d) => d.status === 'DETECTED').length,
      processing: deps.filter((d) => d.status === 'PROCESSING').length,
      success: deps.filter((d) => d.status === 'SUCCESS').length,
      failed: deps.filter((d) => d.status === 'FAILED').length,
    };
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">RDA Test Service</h1>
            <p className="text-gray-400 text-sm">Reusable Deposit Address Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-400">Last update: {lastUpdate.toLocaleTimeString()}</div>
            <select
              value={pollInterval}
              onChange={(e) => setPollInterval(Number(e.target.value))}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
            >
              <option value={2}>Poll: 2s</option>
              <option value={5}>Poll: 5s</option>
              <option value={10}>Poll: 10s</option>
              <option value={30}>Poll: 30s</option>
            </select>
            <button onClick={refreshAll} className="bg-blue-600 hover:bg-blue-700 px-4 py-1 rounded text-sm">
              Refresh Now
            </button>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg border border-gray-700">
              <div className="px-4 py-3 border-b border-gray-700">
                <h2 className="font-semibold">Deposit Addresses ({addresses.length})</h2>
              </div>
              {loading ? (
                <div className="p-8 text-center text-gray-400">Loading...</div>
              ) : addresses.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No addresses found yet.</div>
              ) : (
                <AddressTable
                  addresses={addresses}
                  selectedAddress={selectedAddress}
                  onSelect={setSelectedAddress}
                  getStatusSummary={getStatusSummary}
                  onFetchStatus={fetchStatus}
                />
              )}
            </div>
          </div>

          <div className="space-y-6">
            {selectedAddress ? (
              <WithdrawalsPanel
                address={selectedAddress}
                deposits={deposits[selectedAddress.id] || []}
                notes={statusNotes[selectedAddress.id] || []}
                onRefresh={() => fetchStatus(selectedAddress.id)}
              />
            ) : (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 text-sm text-gray-400">
                Select an address row and click <span className="text-gray-200">Show Pending</span> or{' '}
                <span className="text-gray-200">Show Transactions</span> to view deposit activity.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
