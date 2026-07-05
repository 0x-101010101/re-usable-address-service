import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AddressEntity } from './address.entity';
import { OneClickService, OneClickQuoteResponse } from '../one-click/one-click.service';
import {
  AddressResponse,
  GetOrCreateAddressRequest,
  ListAddressesOptions,
  ListAddressesResponse,
} from './address.types';

const EVM_CHAIN_ALIASES = new Set([
  'evm',
  'eth',
  'ethereum',
  'arb',
  'arbitrum',
  'base',
  'bsc',
  'bnb',
  'op',
  'optimism',
  'pol',
  'polygon',
  'avax',
  'avalanche',
  'gnosis',
]);

@Injectable()
export class AddressService {
  constructor(
    @InjectRepository(AddressEntity)
    private readonly repo: Repository<AddressEntity>,
    private readonly oneClickService: OneClickService,
  ) {}

  async getOrCreateAddress(request: GetOrCreateAddressRequest) {
    const normalizedDepositChain = this.normalizeDepositChain(request.depositChain);
    const whereClause = {
      userId: request.userId,
      depositChain: normalizedDepositChain,
      destinationAsset: request.destinationAsset,
    };

    const existing = await this.repo.findOne({ where: whereClause });
    if (existing) return this.toResponse(existing, true);

    try {
      const quote = await this.oneClickService.createAnyInputQuote({
        destinationAsset: request.destinationAsset,
        recipient: request.recipient,
        recipientType: 'DESTINATION_CHAIN',
        refundTo: request.refundTo,
        refundType: request.refundTo ? 'ORIGIN_CHAIN' : undefined,
        appFees: request.appFees,
      });

      const entity = await this.saveAddress(request, quote, normalizedDepositChain);
      return this.toResponse(entity, false);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const racedEntity = await this.repo.findOne({ where: whereClause });
        if (racedEntity) return this.toResponse(racedEntity, true);
        
      }
      throw error;
    }
  }

  private async saveAddress(
    request: GetOrCreateAddressRequest,
    quote: OneClickQuoteResponse,
    normalizedDepositChain: string,
  ) {
    const chainDepositAddresses = quote.quote.chainDepositAddresses;
    const depositAddress = this.resolveDepositAddress(request.depositChain, normalizedDepositChain, quote);

    const entity = this.repo.create({
      userId: request.userId,
      depositChain: normalizedDepositChain,
      destinationChain: request.destinationChain,
      destinationAsset: request.destinationAsset,
      recipient: request.recipient,
      depositAddress,
      accountId: quote.accountId,
      memo: quote.quote.stellarMemo ?? quote.quote.depositMemo ?? null,
      refundTo: request.refundTo ?? null,
      refundChain: request.refundChain ?? null,
      chainDepositAddressesJson: JSON.stringify(chainDepositAddresses),
    });

    return this.repo.save(entity);
  }

  private resolveDepositAddress(
    requestedDepositChain: string,
    normalizedDepositChain: string,
    quote: OneClickQuoteResponse,
  ) {
    const chainDepositAddresses = quote.quote.chainDepositAddresses;
    if (normalizedDepositChain === 'near') {
      return chainDepositAddresses.near ?? quote.accountId;
    }
    if (normalizedDepositChain === 'evm') {
      return chainDepositAddresses.eth ?? chainDepositAddresses.arb ?? chainDepositAddresses.base ?? quote.quote.depositAddress;
    }

    return chainDepositAddresses[requestedDepositChain.toLowerCase()] ?? quote.quote.depositAddress;
  }

  private normalizeDepositChain(rawDepositChain: string) {
    const normalized = rawDepositChain.trim().toLowerCase();
    return EVM_CHAIN_ALIASES.has(normalized) ? 'evm' : normalized;
  }

  async findById(id: number) {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toResponse(entity, true) : null;
  }

  async listAll(options?: ListAddressesOptions) {
    const [entities, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      take: options?.limit ?? 100,
      skip: options?.offset ?? 0,
    });
    return { addresses: entities.map((entity) => this.toResponse(entity, true)), total };
  }

  async updateDepositStats(id: number, stats: { depositCount: number; lastDepositAt?: string }) {
    await this.repo.update(id, {
      depositCount: stats.depositCount,
      ...(stats.lastDepositAt && { lastDepositAt: new Date(stats.lastDepositAt) }),
    });
  }

  private isUniqueViolation(error: unknown) {
    if (!(error instanceof QueryFailedError)) return false;

    const driverError = error.driverError
    const code = driverError?.code ?? '';
    const message = (driverError?.message ?? error.message ?? '').toLowerCase();

    return code === '23505' || code === 'SQLITE_CONSTRAINT' || message.includes('unique') || message.includes('duplicate');
  }

  private toResponse(entity: AddressEntity, alreadyExists: boolean): AddressResponse {
    return {
      id: entity.id,
      userId: entity.userId,
      depositChain: entity.depositChain,
      destinationChain: entity.destinationChain,
      destinationAsset: entity.destinationAsset,
      recipient: entity.recipient,
      depositAddress: entity.depositAddress,
      memo: entity.memo,
      accountId: entity.accountId,
      alreadyExists,
      chainDepositAddresses: entity.chainDepositAddresses,
      createdAt: entity.createdAt,
      depositCount: entity.depositCount,
      lastDepositAt: entity.lastDepositAt,
    };
  }
}
