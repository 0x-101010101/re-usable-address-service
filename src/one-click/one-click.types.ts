import type { AppFee } from '../address/address.types';

export interface CreateAnyInputQuoteRequest {
  destinationAsset: string;
  recipient: string;
  recipientType: 'DESTINATION_CHAIN' | 'INTENTS';
  refundTo?: string;
  refundType?: 'ORIGIN_CHAIN' | 'INTENTS';
  slippageTolerance?: number;
  appFees?: AppFee[];
}

export interface OneClickQuoteResponse {
  accountId: string;
  quote: {
    depositAddress: string;
    chainDepositAddresses: Record<string, string>;
    stellarMemo?: string;
    depositMemo?: string;
  };
}

export interface AnyInputWithdrawal {
  status: 'PROCESSING' | 'SUCCESS' | 'FAILED';
  amountOutFormatted: string;
  amountOutUsd: string;
  amountOut: string;
  withdrawFeeFormatted: string;
  withdrawFee: string;
  withdrawFeeUsd: string;
  timestamp: string;
  hash: string;
}

export interface WithdrawalsResponse {
  depositAddress: string;
  depositMemo?: string | null;
  withdrawals: AnyInputWithdrawal[];
}

export interface BridgeDeposit {
  tx_hash: string;
  chain: string;
  token: string;
  amount: string;
  amountFormatted?: string;
  status: string;
  timestamp: string;
  confirmations?: number;
}

export interface RecentDepositsResponse {
  deposits: BridgeDeposit[];
  hasMore?: boolean;
}

export interface GetRecentDepositsOptions {
  depositChain?: string;
}
