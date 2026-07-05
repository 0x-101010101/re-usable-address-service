import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { AddressService } from './address.service';
import {
  AddressResponse,
  UnifiedDeposit,
  UnifiedStatusResponse,
  UnifiedStatusSummary,
} from './address.types';
import { CreateAddressDto } from './dto/create-address.dto';
import {
  OneClickService,
  WithdrawalsResponse,
  AnyInputWithdrawal,
  RecentDepositsResponse,
  BridgeDeposit,
} from '../one-click/one-click.service';

const EMPTY_DEPOSITS_RESPONSE: RecentDepositsResponse = { deposits: [] };
const EMPTY_WITHDRAWALS_RESPONSE: WithdrawalsResponse = { depositAddress: '', withdrawals: [] };

@Controller()
export class AddressController {
  constructor(
    private readonly addressService: AddressService,
    private readonly oneClickService: OneClickService,
  ) {}

  @Post('address')
  @HttpCode(HttpStatus.OK)
  async createOrGetAddress(@Body() dto: CreateAddressDto) {
    return this.addressService.getOrCreateAddress(dto);
  }

  @Get('address/:id')
  async getAddressById(@Param('id', ParseIntPipe) id: number) {
    const address = await this.addressService.findById(id);
    if (!address) throw new NotFoundException(`Address with id ${id} not found`);
    return address;
  }

  @Get('addresses/all')
  async listAllAddresses(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.addressService.listAll({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('address/:id/unified-status')
  async getUnifiedStatus(@Param('id', ParseIntPipe) id: number): Promise<UnifiedStatusResponse> {
    const address = await this.addressService.findById(id);
    if (!address) throw new NotFoundException(`Address with id ${id} not found`);

    const [bridgeResult, withdrawalsResult] = await Promise.allSettled([
      this.oneClickService.getRecentDeposits(address.accountId, { depositChain: address.depositChain }),
      this.oneClickService.getWithdrawals(address.accountId),
    ]);

    const bridgeRes = bridgeResult.status === 'fulfilled' ? bridgeResult.value : EMPTY_DEPOSITS_RESPONSE;
    const withdrawalsRes = withdrawalsResult.status === 'fulfilled' ? withdrawalsResult.value : EMPTY_WITHDRAWALS_RESPONSE;

    const deposits = this.mergeDeposits(bridgeRes.deposits, withdrawalsRes.withdrawals);
    const summary = this.getSummary(deposits);

    this.addressService.updateDepositStats(id, {
      depositCount: summary.success,
      lastDepositAt: deposits.find((d) => d.status === 'SUCCESS')?.completedAt,
    })

    return { address, deposits, summary };
  }

  private mergeDeposits(bridgeDeposits: BridgeDeposit[], withdrawals: AnyInputWithdrawal[]): UnifiedDeposit[] {
    const sortedDeposits = [...bridgeDeposits].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
    const sortedWithdrawals = [...withdrawals].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));

    return sortedDeposits.map((deposit, i) => {
      const withdrawal = sortedWithdrawals[i];
      const credited = ['completed', 'credited'].includes(deposit.status.toLowerCase());

      return {
        status: (withdrawal?.status ?? (credited ? 'PROCESSING' : 'DETECTED')) as UnifiedDeposit['status'],
        depositTxHash: deposit.tx_hash,
        withdrawTxHash: withdrawal?.hash,
        chain: deposit.chain,
        amountIn: deposit.amount,
        amountInFormatted: deposit.amountFormatted,
        amountOut: withdrawal?.amountOut,
        amountOutUsd: withdrawal?.amountOutUsd,
        detectedAt: deposit.timestamp,
        completedAt: withdrawal?.timestamp,
      };
    });
  }

  private getSummary(deposits: UnifiedDeposit[]): UnifiedStatusSummary {
    return {
      detected: deposits.filter((deposit) => deposit.status === 'DETECTED').length,
      processing: deposits.filter((deposit) => deposit.status === 'PROCESSING').length,
      success: deposits.filter((deposit) => deposit.status === 'SUCCESS').length,
      failed: deposits.filter((deposit) => deposit.status === 'FAILED').length,
      total: deposits.length,
    };
  }

  @Get('health')
  health(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
