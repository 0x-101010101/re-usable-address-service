import { HttpException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type {
  CreateAnyInputQuoteRequest,
  GetRecentDepositsOptions,
  OneClickQuoteResponse,
  RecentDepositsResponse,
  WithdrawalsResponse,
} from './one-click.types';
import {
  buildAnyInputQuotePayload,
  extractStellarMemo,
  getApiKeyHeaders,
  getChainsToQuery,
  getErrorMessage,
  getErrorStatus,
  getJsonHeaders,
  isMissingWithdrawalsError,
  normalizeChainAddresses,
  resolvePoaChain,
} from './one-click.utils';

export type {
  AnyInputWithdrawal,
  BridgeDeposit,
  CreateAnyInputQuoteRequest,
  GetRecentDepositsOptions,
  OneClickQuoteResponse,
  RecentDepositsResponse,
  WithdrawalsResponse,
} from './one-click.types';

@Injectable()
export class OneClickService {
  private readonly logger = new Logger(OneClickService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string | undefined;
  private readonly defaultSlippage: number;
  private readonly deadlineYears: number;

  constructor(private readonly http: HttpService, private readonly config: ConfigService) {
    this.apiUrl = this.config.get<string>('oneClick.apiUrl')!;
    this.apiKey = this.config.get<string>('oneClick.apiKey');
    this.defaultSlippage = this.config.get<number>('defaults.slippageTolerance')!;
    this.deadlineYears = this.config.get<number>('defaults.deadlineYears')!;
  }

  async createAnyInputQuote(request: CreateAnyInputQuoteRequest): Promise<OneClickQuoteResponse> {
    const payload = buildAnyInputQuotePayload(request, this.defaultSlippage, this.deadlineYears);
    try {
      const response = await firstValueFrom(
        this.http.post(`${this.apiUrl}/v0/quote`, payload, {
          headers: getJsonHeaders(this.apiKey),
        }),
      );

      const quote = this.normalizeQuoteResponse(response.data);
      return quote;
    } catch (error) {
      const message = getErrorMessage(error);
      const status = getErrorStatus(error) ?? 502;
      this.logger.error(`One Click API error: ${message}`);
      throw new HttpException(`One Click API error: ${message}`, status);
    }
  }

  async getWithdrawals(depositAddress: string): Promise<WithdrawalsResponse> {
    try {
      const response = await firstValueFrom(
        this.http.get<WithdrawalsResponse>(`${this.apiUrl}/v0/any-input/withdrawals`, {
          params: { depositAddress, limit: 50 },
          headers: getApiKeyHeaders(this.apiKey),
        }),
      );
      return response.data;
    } catch (error) {
      if (isMissingWithdrawalsError(error)) {
        return { depositAddress, withdrawals: [] };
      }
      throw error;
    }
  }

  async getRecentDeposits(accountId: string, options?: GetRecentDepositsOptions): Promise<RecentDepositsResponse> {
    const chains = getChainsToQuery(options?.depositChain);
    const chainDeposits = chains.map((chain) => this.getDepositsForChain(accountId, chain))
    
    const results = await Promise.all(chainDeposits);
    const deposits = results.flatMap((result) => result.deposits).sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
    return { deposits, hasMore: results.some((r) => r.hasMore) };
  }

  private async getDepositsForChain(accountId: string, chain: string): Promise<RecentDepositsResponse> {
    const bridgeUrl = this.config.get<string>('poaBridge.apiUrl') ?? 'https://poa-bridge.chaindefuser.com/rpc';
    try {
      const response = await firstValueFrom(
        this.http.post(bridgeUrl, {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'recent_deposits',
          params: [{ account_id: accountId, chain: resolvePoaChain(chain), limit: 50, offset: 0 }],
        }),
      );
      const result = response.data.result;
      return result?.error ? { deposits: [] } : { deposits: result?.deposits ?? [], hasMore: result?.hasMore ?? false };
    } catch {
      return { deposits: [] };
    }
  }

  private normalizeQuoteResponse(raw: any): OneClickQuoteResponse {
    const chainDepositAddresses = normalizeChainAddresses(raw.quote?.chainDepositAddresses);
    const accountId = raw.accountId ?? raw.quote?.depositAddress ?? chainDepositAddresses.near ?? '';
    if (!accountId) {
      throw new Error('Missing accountId in response');
    }

    return {
      accountId,
      quote: {
        depositAddress: raw.quote?.depositAddress ?? accountId,
        chainDepositAddresses,
        stellarMemo: raw.quote?.stellarMemo ?? extractStellarMemo(raw.quote?.chainDepositAddresses),
        depositMemo: raw.quote?.depositMemo,
      },
    };
  }
}
