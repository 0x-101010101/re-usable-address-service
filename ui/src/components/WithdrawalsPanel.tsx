import type { Address, UnifiedDeposit } from '../App';
import { StatusBadge } from './StatusBadge';

interface Props {
  address: Address;
  deposits: UnifiedDeposit[];
  notes: string[];
  onRefresh: () => void;
}

export function WithdrawalsPanel({ address, deposits, notes, onRefresh }: Props) {
  const truncate = (str: string, len: number = 16) => {
    if (!str || str.length <= len) return str || '—';
    return str.slice(0, len / 2) + '...' + str.slice(-len / 2);
  };

  const getStatusStyle = (status: UnifiedDeposit['status']) => {
    switch (status) {
      case 'DETECTED':
        return 'bg-blue-500/10 border-blue-500/30';
      case 'PROCESSING':
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 'SUCCESS':
        return 'bg-green-500/10 border-green-500/30';
      case 'FAILED':
        return 'bg-red-500/10 border-red-500/30';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Deposit Status</h2>
          <p className="text-xs text-gray-400">{truncate(address.depositAddress, 24)}</p>
        </div>
        <button onClick={onRefresh} className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">
          Refresh
        </button>
      </div>

      <div className="p-4 max-h-96 overflow-y-auto">
        {deposits.length === 0 ? (
          <div className="text-center text-gray-400 py-4">
            <p>No deposits detected yet</p>
            <p className="text-xs mt-1">Send funds to the deposit address to see them here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deposits.map((d, i) => (
              <div key={i} className={`rounded border p-3 ${getStatusStyle(d.status)}`}>
                <div className="flex items-center justify-between mb-2">
                  <StatusBadge status={d.status} />
                  <span className="text-xs text-gray-400">
                    {d.completedAt ? new Date(d.completedAt).toLocaleString() : new Date(d.detectedAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-gray-400">Chain:</span>
                    <span className="bg-gray-700 px-2 py-0.5 rounded text-xs uppercase">{d.chain}</span>
                  </div>
                  {d.amountOutUsd && (
                    <div className="mb-1">
                      <span className="text-gray-400">Amount:</span>
                      <span className="ml-2 font-medium">${d.amountOutUsd}</span>
                    </div>
                  )}
                </div>
                <div className="mt-2 text-xs space-y-1">
                  <div>
                    <span className="text-gray-400">Deposit TX:</span>
                    <span className="ml-2 font-mono text-gray-300">{truncate(d.depositTxHash, 20)}</span>
                  </div>
                  {d.withdrawTxHash && (
                    <div>
                      <span className="text-gray-400">Withdraw TX:</span>
                      <span className="ml-2 font-mono text-gray-300">{truncate(d.withdrawTxHash, 20)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {notes.length > 0 && (
          <div className="mt-4 p-2 bg-gray-700/50 rounded text-xs text-gray-400">
            {notes.map((note, i) => (
              <p key={i}>{note}</p>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-700 bg-gray-750 rounded-b-lg">
        <div className="text-xs text-gray-400">
          <strong>Status Flow:</strong>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Detected</span>
            <span className="text-gray-500">→</span>
            <span className="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">Processing</span>
            <span className="text-gray-500">→</span>
            <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Success</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
            <span>User:</span>
            <span className="text-gray-300">{address.userId}</span>
            <span>Route:</span>
            <span className="text-gray-300">
              {address.depositChain} → {address.destinationChain}
            </span>
            <span>Account ID:</span>
            <span className="text-gray-300 font-mono">{truncate(address.accountId, 16)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
