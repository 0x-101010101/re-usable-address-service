import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AppFeeDto {
  @IsString()
  @IsNotEmpty()
  recipient: string;

  @IsInt()
  @Min(0)
  @Max(500)
  fee: number;
}

/**
 * DTO for creating a Reusable deposit address.
 *
 * This mirrors what an external partner would send to their own wrapper API.
 * The wrapper then calls One Click with additional fields.
 */
export class CreateAddressDto {
  /**
   * Partner's internal user identifier.
   * This scopes addresses per-user within your system.
   */
  @IsString()
  @IsNotEmpty()
  userId: string;

  /**
   * Chain the user will deposit FROM.
   * Examples: 'btc', 'eth', 'arb', 'sol', 'tron', 'evm' (shortcut for any EVM)
   *
   * Note: All EVM chains share the same address, so 'eth', 'arb', 'base' etc.
   * will all return the same deposit address.
   */
  @IsString()
  @IsNotEmpty()
  depositChain: string;

  /**
   * Chain the user will receive funds ON.
   * Examples: 'eth', 'base', 'near'
   */
  @IsString()
  @IsNotEmpty()
  destinationChain: string;

  /**
   * Asset the user wants to receive.
   * Can be a symbol like 'USDC' or a full Defuse asset ID.
   * Examples: 'USDC', 'nep141:usdc.near', 'nep141:base-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near'
   */
  @IsString()
  @IsNotEmpty()
  destinationAsset: string;

  /**
   * Address to receive the funds on the destination chain.
   * For CEX use cases, this is typically your hot wallet address.
   */
  @IsString()
  @IsNotEmpty()
  recipient: string;

  /**
   * Optional: Address to send refunds to if swaps fail permanently.
   * If not provided, refunds go back to the deposit address (auto-retry).
   */
  @IsString()
  @IsOptional()
  refundTo?: string;

  /**
   * Optional: Chain to send refunds to.
   * Only used if refundTo is provided.
   */
  @IsString()
  @IsOptional()
  refundChain?: string;

  /**
   * Optional: App fees to charge on swaps.
   * Array of { recipient, fee } where fee is in basis points (1-500).
   */
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AppFeeDto)
  appFees?: AppFeeDto[];
}
