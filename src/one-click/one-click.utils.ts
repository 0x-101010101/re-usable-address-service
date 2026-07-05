import type { CreateAnyInputQuoteRequest } from './one-click.types';

export const POA_CHAIN_FORMAT: Record<string, string> = {
  near: 'near:mainnet',
  eth: 'eth:1',
  base: 'eth:8453',
  arb: 'eth:42161',
  btc: 'btc:mainnet',
  sol: 'sol:mainnet',
  ton: 'ton:mainnet',
  tron: 'tron:mainnet',
  sui: 'sui:mainnet',
  stellar: 'stellar:mainnet',
  aptos: 'aptos:mainnet',
  gnosis: 'eth:100',
  bsc: 'eth:56',
  pol: 'eth:137',
  avax: 'eth:43114',
  op: 'eth:10',
};

export const EVM_CHAINS = ['eth', 'base', 'arb', 'gnosis', 'bsc', 'pol', 'avax', 'op'] as const;
export const SUPPORTED_DEPOSIT_CHAINS = [...EVM_CHAINS, 'btc', 'sol', 'ton', 'tron', 'sui', 'stellar', 'aptos', 'near'];

export type ChainAddressItem = { blockchain: string; address: string; memo?: string };
const EVM_ADDRESS_PREFIX = '0x';

export function resolvePoaChain(chain: string) {
  return POA_CHAIN_FORMAT[chain] ?? chain;
}

export function getChainsToQuery(depositChain?: string) {
  if (!depositChain) {
    return SUPPORTED_DEPOSIT_CHAINS;
  }
  return depositChain === 'evm' ? [...EVM_CHAINS] : [depositChain];
}

export function normalizeChainAddresses(
  raw: Record<string, string> | ChainAddressItem[] | undefined,
): Record<string, string> {
  if (!raw) return {};
  if (!Array.isArray(raw)) return raw;

  return raw.reduce<Record<string, string>>((accumulator, item) => {
    if (item.blockchain && item.address) {
      accumulator[item.blockchain] = item.address;
    }
    return accumulator;
  }, {});
}

export function extractStellarMemo(rawChainAddresses: unknown) {
  if (!Array.isArray(rawChainAddresses)) {
    return undefined;
  }

  const stellarAddress = rawChainAddresses.find(
    (item): item is ChainAddressItem =>
      typeof item === 'object' &&
      item !== null &&
      'blockchain' in item &&
      'memo' in item &&
      (item as ChainAddressItem).blockchain === 'stellar',
  );

  return stellarAddress?.memo;
}

export function getApiKeyHeaders(apiKey?: string) {
  return apiKey ? { 'x-api-key': apiKey } : {};
}

export function getJsonHeaders(apiKey?: string) {
  return { 'Content-Type': 'application/json', ...getApiKeyHeaders(apiKey) };
}

export function getQuoteDeadlineIso(deadlineYears: number) {
  const deadline = new Date();
  deadline.setFullYear(deadline.getFullYear() + deadlineYears);
  return deadline.toISOString();
}

export function buildAnyInputQuotePayload(
  request: CreateAnyInputQuoteRequest,
  defaultSlippage: number,
  deadlineYears: number,
) {
  const normalizedRecipient = normalizeAddress(request.recipient);
  const normalizedRefundTo = normalizeAddress(request.refundTo ?? request.recipient);

  return {
    dry: false,
    depositMode: 'SIMPLE',
    swapType: 'ANY_INPUT',
    originAsset: '1cs_v1:any',
    depositType: 'INTENTS',
    destinationAsset: request.destinationAsset,
    recipient: normalizedRecipient,
    recipientType: request.recipientType,
    refundTo: normalizedRefundTo,
    refundType: request.refundType ?? 'INTENTS',
    deadline: getQuoteDeadlineIso(deadlineYears),
    slippageTolerance: request.slippageTolerance ?? defaultSlippage,
    amount: '0',
    confidentiality: 'public',
    appFees: request.appFees ?? [],
  };
}

function normalizeAddress(value: string) {
  const normalizedValue = value.trim();
  if (normalizedValue.toLowerCase().startsWith(EVM_ADDRESS_PREFIX)) {
    return normalizedValue.toLowerCase();
  }

  return normalizedValue;
}

export function isMissingWithdrawalsError(error: unknown) {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return false;
  }
  const response = (error as { response?: { status?: number } }).response;
  return response?.status === 404 || response?.status === 403;
}

export function getErrorMessage(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return String(error);
  }

  const responseData = (error as { response?: { data?: unknown } }).response?.data;
  if (typeof responseData === 'string' && responseData.trim().length > 0) {
    return responseData;
  }

  if (typeof responseData === 'object' && responseData !== null) {
    const objectData = responseData as Record<string, unknown>;
    const errorMessage =
      (typeof objectData.errorMessage === 'string' && objectData.errorMessage) ||
      (typeof objectData.message === 'string' && objectData.message) ||
      (typeof objectData.error === 'string' && objectData.error);

    if (errorMessage) {
      return errorMessage;
    }

    try {
      return JSON.stringify(responseData);
    } catch {
      // Fall through to generic message.
    }
  }

  const message = (error as { message?: string }).message;
  return message ?? 'Unknown error';
}

export function getErrorStatus(error: unknown) {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return undefined;
  }

  const status = (error as { response?: { status?: number } }).response?.status;
  return typeof status === 'number' ? status : undefined;
}
