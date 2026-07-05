interface Props {
  status: 'DETECTED' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  count?: number;
}

export function StatusBadge({ status, count }: Props) {
  const styles = {
    DETECTED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    PROCESSING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    SUCCESS: 'bg-green-500/20 text-green-400 border-green-500/30',
    FAILED: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const icons = {
    DETECTED: '📥',
    PROCESSING: '⏳',
    SUCCESS: '✓',
    FAILED: '✗',
  };

  const labels = {
    DETECTED: 'Detected',
    PROCESSING: 'Processing',
    SUCCESS: 'Success',
    FAILED: 'Failed',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${styles[status]}`}
    >
      <span>{icons[status]}</span>
      {count !== undefined ? count : labels[status]}
    </span>
  );
}
