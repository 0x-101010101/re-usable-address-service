export interface AppFee {
  recipient: string;
  fee: number;
}

export interface GetOrCreateAddressRequest {
  userId: string;
  depositChain: string;
  destinationChain: string;
  destinationAsset: string;
  recipient: string;
  refundTo?: string;
  refundChain?: string;
  appFees?: AppFee[];
}

export interface AddressResponse {
  id: number;
  userId: string;
  depositChain: string;
  destinationChain: string;
  destinationAsset: string;
  recipient: string;
  depositAddress: string;
  memo: string | null;
  accountId: string;
  alreadyExists: boolean;
  chainDepositAddresses: Record<string, string> | null;
  createdAt: Date;
  depositCount: number;
  lastDepositAt: Date | null;
}

export interface ListAddressesOptions {
  limit?: number;
  offset?: number;
}

export interface ListAddressesResponse {
  addresses: AddressResponse[];
  total: number;
}

export interface UnifiedDeposit {
  status: 'DETECTED' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  depositTxHash: string;
  withdrawTxHash?: string;
  chain: string;
  amountIn: string;
  amountInFormatted?: string;
  amountOut?: string;
  amountOutUsd?: string;
  detectedAt: string;
  completedAt?: string;
}

export interface UnifiedStatusSummary {
  detected: number;
  processing: number;
  success: number;
  failed: number;
  total: number;
}

export interface UnifiedStatusResponse {
  address: AddressResponse;
  deposits: UnifiedDeposit[];
  summary: UnifiedStatusSummary;
}
