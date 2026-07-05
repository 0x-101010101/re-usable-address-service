import { useEffect, useRef } from 'react';
import type { Address } from '../App';
import { StatusBadge } from './StatusBadge';

interface Props {
  addresses: Address[];
  selectedAddress: Address | null;
  onSelect: (addr: Address) => void;
  getStatusSummary: (addressId: number) => {
    total: number;
    detected: number;
    processing: number;
    success: number;
    failed: number;
  };
  onFetchStatus: (addressId: number) => void;
}

export function AddressTable({ addresses, selectedAddress, onSelect, getStatusSummary, onFetchStatus }: Props) {
  const initialFetchDone = useRef(false);

  useEffect(() => {
    if (addresses.length > 0 && !initialFetchDone.current) {
      initialFetchDone.current = true;
      for (const addr of addresses) {
        onFetchStatus(addr.id);
      }
    }
  }, [addresses, onFetchStatus]);

  const truncate = (str: string, len: number = 12) => {
    if (str.length <= len) return str;
    return str.slice(0, len / 2) + '...' + str.slice(-len / 2);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-750">
          <tr className="text-left text-gray-400 text-xs uppercase">
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Route</th>
            <th className="px-4 py-3">Deposit Address</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Deposits</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {addresses.map((addr) => {
            const summary = getStatusSummary(addr.id);
            const isSelected = selectedAddress?.id === addr.id;
            const hasActive = summary.processing > 0 || summary.detected > 0;

            return (
              <tr
                key={addr.id}
                className={`transition-colors ${
                  isSelected ? 'bg-blue-900/30' : hasActive ? 'bg-yellow-900/20 hover:bg-yellow-900/30' : 'hover:bg-gray-750'
                }`}
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{addr.userId}</div>
                  <div className="text-xs text-gray-500">ID: {addr.id}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="bg-gray-700 px-2 py-0.5 rounded text-xs uppercase">{addr.depositChain}</span>
                    <span className="text-gray-500">→</span>
                    <span className="bg-gray-700 px-2 py-0.5 rounded text-xs uppercase">{addr.destinationChain}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{truncate(addr.destinationAsset, 30)}</div>
                </td>
                <td className="px-4 py-3">
                  <div
                    className="font-mono text-xs cursor-pointer hover:text-blue-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(addr.depositAddress);
                    }}
                    title="Click to copy"
                  >
                    {truncate(addr.depositAddress, 16)}
                  </div>
                  {addr.memo && <div className="text-xs text-gray-500">Memo: {addr.memo}</div>}
                </td>
                <td className="px-4 py-3">
                  {summary.total === 0 ? (
                    <span className="text-gray-500 text-xs">No activity</span>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {summary.detected > 0 && <StatusBadge status="DETECTED" count={summary.detected} />}
                      {summary.processing > 0 && <StatusBadge status="PROCESSING" count={summary.processing} />}
                      {summary.success > 0 && <StatusBadge status="SUCCESS" count={summary.success} />}
                      {summary.failed > 0 && <StatusBadge status="FAILED" count={summary.failed} />}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="font-medium">{addr.depositCount}</div>
                  {addr.lastDepositAt && (
                    <div className="text-xs text-gray-500">{new Date(addr.lastDepositAt).toLocaleDateString()}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(addr);
                      onFetchStatus(addr.id);
                    }}
                    className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                  >
                    {hasActive ? 'Show Pending' : 'Show Transactions'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
