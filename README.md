# Reusable Deposit Address Service Guide

 This repository serves as a **guide** for building a re-usable deposit addresses service wrapper around One Click API's ANY_INPUT mechanism. This service is to be used as an intro into the architecture, so that it can be adapted it for your production environment.

---

## Architecture

This reference implementation is minimal ny design and only scopes the core design principles. Your service should only need to handle caching and API exposure. Then One Click handles everything else such deposit detection, swap execution, and withdrawal to the final recipient and so on etc

Architecture Diagram

### Core Components

The project is organized into focused services, each with a single responsibility:


| Service          | File                                 | Responsibility                                               |
| ---------------- | ------------------------------------ | ------------------------------------------------------------ |
| REST API         | `src/address/address.controller.ts`  | Exposes endpoints for creating addresses and querying status |
| Address Service  | `src/address/address.service.ts`     | Implements caching logic, chain normalization, idempotency   |
| One Click Client | `src/one-click/one-click.service.ts` | HTTP client for One Click Quote and Status APIs              |
| Database Entity  | `src/address/address.entity.ts`      | TypeORM entity defining the address cache schema             |


### How to Think About Each Layer

**The RDA consumer Application** should call th re-usable address service when a user needs a deposit address. For example, this could be a frontend requesting an address to display, or a backend provisioning addresses for new users.

**The Re-usable Address Service** itself is just simply the the caching and idempotency layer. Its only job is to ensure the same inputs always return the same address. It should do  this by:

- Checking your database for an existing address matching the request parameters
- On cache miss, call the One Click API to create a new ANY_INPUT quote
- Store the returned address in your database
- Returning the address (cached or new) to your application

**The One Click Infrastructure** handles everything after the address is created:

- Monitors all supported chains for incoming deposits (via POA Bridge)
- Detects when funds arrive at the deposit address
- Creates child quotes to swap deposited tokens to the destination asset
- Executes swaps via the solver network
- Withdraws funds to the recipient on the destination chain

In this example, the sniuppet below shows the exact API entrypoint that partners integrate with. It delegates immediately to the caching service.

```typescript
@Post('address')
@HttpCode(HttpStatus.OK)
async createOrGetAddress(@Body() dto: CreateAddressDto) {
  return this.addressService.getOrCreateAddress(dto);
}
```

---

## Address creation

The Address Service (`src/address/address.service.ts`) manages the core caching logic. The flow is straightforward: check the cache first, call One Click only on miss.

Address Creation Flow

In this test example each address request contains the following parameters below. But note that the parameters choosen can be arbitrary as long as they yeild a unique but deterministic output.

```typescript
interface CreateAddressRequest {
  userId: string;          
  depositChain: string;  
  destinationChain: string;
  destinationAsset: string;
  recipient: string;       
  refundTo?: string;        
  appFees?: AppFee[];      
}
```

The re usable address service handles each incoming request by:

1. **Normalizing the chain** — all EVM chains map to `evm` since they share one deposit address
2. **Checking the cache** — looks up existing address by unique key
3. **Calling One Click** — on cache miss, creates an ANY_INPUT quote
4. **Storing the result** — saves the address with a unique constraint for idempotency

The core idempotency logic is implemented in `AddressService`. This is the key flow (cache lookup -> quote on miss -> race-safe fallback):

```typescript
const whereClause = {
  userId: request.userId,
  depositChain: normalizedDepositChain,
  destinationAsset: request.destinationAsset,
};

const existing = await this.repo.findOne({ where: whereClause });
if (existing) return this.toResponse(existing, true);

try {
  const quote = await this.oneClickService.createAnyInputQuote({ ... });
  const entity = await this.saveAddress(request, quote, normalizedDepositChain);
  return this.toResponse(entity, false);
} catch (error) {
  if (this.isUniqueViolation(error)) {
    const racedEntity = await this.repo.findOne({ where: whereClause });
    if (racedEntity) return this.toResponse(racedEntity, true);
  }
  throw error;
}
```

---

## Chain normalization

Its worth highlightig the concept of chain normalisation since there is some pre-requisitie knoweldgae here. So since All EVM chains share the same deposit address, the service should normalizes them before lookup. This ensures that requesting an address for "arb" and later for "eth" returns the same cached address.

```typescript
const EVM_CHAIN_ALIASES = new Set([
  'evm', 'eth', 'ethereum', 'arb', 'arbitrum', 'base', 
  'bsc', 'bnb', 'op', 'optimism', 'pol', 'polygon', 
  'avax', 'avalanche', 'gnosis'
]);

// its is not nessecary to normalise like this for EVM chains if your desired output if
// ETH => ARB strictly. But as extra resiliance we decide to support EVM => ARB so that if a user  
// makes a mistake the swap will still happen. This only an EVM tactic since all evm chains will have // the same deposit address
private normalizeDepositChain(rawDepositChain: string) {
  const normalized = rawDepositChain.trim().toLowerCase();
  return EVM_CHAIN_ALIASES.has(normalized) ? 'evm' : normalized;
}
```

The unique constraint in the database uses the normalized chain:

```typescript
@Unique('UQ_user_chain_asset', ['userId', 'depositChain', 'destinationAsset'])
```

This guarantees idempotency in the sense that the same inputs always return the same address.

Once the quote is returned, the service picks a deposit address deterministically for the normalized chain:

```typescript
// on near deposit chain the deposit address is the quote accountid
if (normalizedDepositChain === 'near') {
  return quote.accountId;
}
// else we use the chainDeposit address returned for the 1click ANY_INPUT quote at key of the chain we 
// are targeting. else fallback to quote.quote.depositAddress is a fallback and can be a generic base // account-style address.
return chainDepositAddresses[requestedDepositChain.toLowerCase()] ?? quote.quote.depositAddress;
```

---

## Calling One Click

When the cache misses, the One Click Service (`src/one-click/one-click.service.ts`) creates an ANY_INPUT quote. This quote type accepts any token at any amount.

```typescript
async createAnyInputQuote(request: CreateAnyInputQuoteRequest): Promise<OneClickQuoteResponse> {
  const payload = {
    dry: false,
    depositMode: 'SIMPLE',
    swapType: 'ANY_INPUT',
    originAsset: '1cs_v1:any',           // Accept any token
    depositType: 'INTENTS',
    destinationAsset: request.destinationAsset,
    recipient: request.recipient,
    recipientType: 'DESTINATION_CHAIN',
    refundTo: request.refundTo ?? request.recipient,
    refundType: 'INTENTS',
    deadline: getQuoteDeadlineIso(10),   // 10 years
    slippageTolerance: 0.01,
    amount: '0',
    confidentiality: 'public',
    appFees: request.appFees ?? [],
  };

  const response = await this.http.post(`${this.apiUrl}/v0/quote`, payload);
  return this.normalizeQuoteResponse(response.data);
}
```

Before sending payloads, EVM-style addresses are normalized to lowercase so upstream validation is stable:

```typescript
const normalizedRecipient = normalizeAddress(request.recipient);
const normalizedRefundTo = normalizeAddress(request.refundTo ?? request.recipient);

recipient: normalizedRecipient,
refundTo: normalizedRefundTo,
```

The response includes deposit addresses for all supported chains:

```typescript
interface OneClickQuoteResponse {
  accountId: string;  // NEAR account ID
  quote: {
    depositAddress: string;
    chainDepositAddresses: {
      eth: string;    // Shared by all EVM chains
      arb: string;
      base: string;
      btc: string;    // Unique per non-EVM chain
      sol: string;
      tron: string;
      // ...
    };
  };
}
```

> **Note:** One Click generates a unique address for every request (the derivation includes timestamps). This is why caching is required so you cannot fully rely on One Click to return the same address for identical inputs.

---

## Deposit processing

Once an address exists, then thats pretty much it and your service's job is pretty uch done. One Click handles the entire deposit lifecycle automatically and  nothing else is involved in any of these steps.

Deposit Processing Flow

The processing happens in six stages:

1. **User deposits** — sends funds to the deposit address on any supported chain
2. **Bridge detects** — POA Bridge monitors all chains for incoming transfers
3. **Bridge to NEAR** — funds are bridged and credited to the NEAR account
4. **child quote** created— 1Click creates and checks child quotes for new balances to process them
5. **Swap executes** — a child EXACT_INPUT quote swaps to the destination asset
6. **Withdrawal** — funds are bridged to the recipient on the destination chain

Deposits typically process within 1-5 minutes, depending on the source chain's confirmation time. For BTC it will be slower given the 10 minute confirmation tme. So for BTC a deposit would take 10 mins to get confirmed + 2/3 mins for 1clcik flow

---

## Status tracking

While deposit processing is automatic, you'll want to show users the status of their deposits. The challenge is that status information is split across two APIs. The POA Bridge knows about detected deposits, and the 1click API's withdrawals endpoint knows about pending & completed swaps.

The controller (`src/address/address.controller.ts`) provides a unified status endpoint that merges both sources into a single response. This is the main trick of the integration to get right as 1clcik does not natively support a single endpoint at the moment for getting unified reusable deposit quote statues out of the box. This will be up to you to design as you see fit

Status Tracking Diagram

```typescript
@Get('address/:id/unified-status')
async getUnifiedStatus(@Param('id') id: number): Promise<UnifiedStatusResponse> {
  const address = await this.addressService.findById(id);

  // Query both APIs in parallel
  const [bridgeResult, withdrawalsResult] = await Promise.allSettled([
    this.oneClickService.getRecentDeposits(address.accountId),
    this.oneClickService.getWithdrawals(address.accountId),
  ]);

  // Merge into unified view
  const deposits = this.mergeDeposits(bridgeRes.deposits, withdrawalsRes.withdrawals);
  
  return { address, deposits, summary: this.getSummary(deposits) };
}
```

The unified response tracks each deposit through its lifecycle:

```typescript
interface UnifiedDeposit {
  status: 'DETECTED' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  depositTxHash: string;
  withdrawTxHash?: string;
  chain: string;
  amountIn: string;
  amountOut?: string;
  detectedAt: string;
  completedAt?: string;
}
```

This endpoint builds a unified view by querying bridge deposits and withdrawals concurrently, then merging:

```typescript
const [bridgeResult, withdrawalsResult] = await Promise.allSettled([
  this.oneClickService.getRecentDeposits(address.accountId, { depositChain: address.depositChain }),
  this.oneClickService.getWithdrawals(address.accountId),
]);

const bridgeRes = bridgeResult.status === 'fulfilled' ? bridgeResult.value : { deposits: [] };
const withdrawalsRes = withdrawalsResult.status === 'fulfilled' ? withdrawalsResult.value : { withdrawals: [] };
const deposits = this.mergeDeposits(bridgeRes.deposits, withdrawalsRes.withdrawals);
```


| Status       | Meaning                                    |
| ------------ | ------------------------------------------ |
| `DETECTED`   | Deposit seen on chain, waiting for bridge  |
| `PROCESSING` | Bridged to NEAR, swap in progress          |
| `SUCCESS`    | Completed, funds sent to recipient         |
| `FAILED`     | Failed (will auto-retry on next cron tick) |


---

## Production considerations

The reference implementation uses SQLite for simplicity. For production:

- **Replace SQLite** with PostgreSQL for better concurrency
- **Add authentication** to your API endpoints
- **Add rate limiting** to prevent abuse
- **Monitor cache hit rate** — should be >90% for reusable addresses
- **Set up alerting** for stuck deposits or API errors
- **Run a chain indexer** for watched deposit addresses so you can show "pending detection" before One Click/bridge polling picks up deposits
- **Consider a deterministic request hash key** — for larger scale, hashing normalized route params (e.g. `userId + depositChain + destinationAsset + recipient`) into a single indexed key can make cache mapping stricter and easier to audit across services
- invest time into robust status tracking maybe ending confirmation indexing for BTC

For BTC routes specifically, status may remain empty until the deposit has at least one BTC confirmation and is detected by the bridge flow.

The unique constraint handles concurrent requests for the same address but For high-traffic scenarios, consider adding a distributed lock (Redis) before the One Click call.

## API Reference

### Create or get address

```bash
POST /address
Content-Type: application/json

{
  "userId": "user-123",
  "depositChain": "eth",
  "destinationChain": "base",
  "destinationAsset": "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
  "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD12"
}
```

The `alreadyExists` field indicates whether this was a cache hit (`true`) or a new address (`false`).

### Get unified status

```bash
GET /address/<USERID>/unified-status
```

---

## Quick Start

clone this repository and run `pnpm install` that is all that needs to be done in terms of setup. Note you will need to include your partnerID and API key in your env file for correct authentication to the 1clcik api

```bash
cp .env.example .env
# Edit .env with your settings
```

### Run the service

```bash
# Run in two terminals:
# Terminal 1 (API)
pnpm start
#
# Terminal 2 (UI)
pnpm ui
```

- API: `http://localhost:3100`
- UI: `http://localhost:3101`

### Test address creation

```bash
curl -X POST http://localhost:3100/address \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-1",
    "depositChain": "eth",
    "destinationChain": "base",
    "destinationAsset": "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
    "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD12"
  }'
```

---

## Testing the Full Flow

Once the service is running, follow these steps to test the complete deposit lifecycle.

### Step 1: Create a deposit address

Generate a new address for receiving ETH deposits and converting to USDC on Base:

```bash
curl -X POST http://localhost:3100/address \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "demo-user-1",
    "depositChain": "eth",
    "destinationChain": "base",
    "destinationAsset": "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
    "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD12"
  }'
```

Response:

```json
{
  "id": 1,
  "userId": "demo-user-1",
  "depositChain": "evm",
  "destinationChain": "base",
  "destinationAsset": "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
  "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD12",
  "depositAddress": "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12",
  "accountId": "abc123def456789...",
  "alreadyExists": false,
  "chainDepositAddresses": {
    "eth": "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12",
    "arb": "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12",
    "base": "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12",
    "btc": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "sol": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
  },
  "createdAt": "2026-07-05T15:00:00.000Z"
}
```

Note the `depositAddress`as this is what you show to the user. Since we requested `eth`, this is an EVM address and can be used from Ethereum or other EVM chains. The returned `depositChain` is `evm` because the service normalizes all EVM inputs `eth`, `arb`, `base` etc to a shared cache key. This is only done to prevent users form doing incorrect chain deposits but is not mandatory or required.

### Step 2: Make a deposit

Send funds to the deposit address on an EVM network:

1. Open your wallet (MetaMask, etc.)
2. Send ETH, USDC, or another supported token to the `depositAddress`
3. Use Ethereum mainnet (or another supported EVM chain)

For testing, use a small amount of ETH on Base for lower gas costs. After sending, the deposit will be detected by the POA Bridge within a few seconds to minutes. One Click will automatically swap to USDC and send to your recipient address.

### Step 3: Poll the unified status

Check the status of deposits for your address:

```bash
curl http://localhost:3100/address/<ID>/unified-status
```

Response while processing:

```json
{
  "address": {
    "id": 1,
    "userId": "demo-user-1",
    "depositAddress": "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12",
    "depositCount": 1,
    "lastDepositAt": "2026-07-05T15:05:00.000Z"
  },
  "deposits": [
    {
      "status": "PROCESSING", // DETECTED | PROCESSING | SUCCESS
      "depositTxHash": "0xabc123...",
      "chain": "eth",
      "amountIn": "100000000000000000",
      "amountInFormatted": "0.1",
      "detectedAt": "2026-07-05T15:05:00.000Z"
    }
  ],
  "summary": {
    "detected": 0,
    "processing": 1,
    "success": 0,
    "failed": 0,
    "total": 1
  }
}
```

---

## Dashboard UI

The service includes a React dashboard for visualizing addresses and monitoring deposit statuses in real-time.

### Setup

```bash
# Install all dependencies
pnpm install

# Run in two terminals:
# Terminal 1 (API)
pnpm start
#
# Terminal 2 (UI)
pnpm ui
```

This starts:

- API on `http://localhost:3100`
- UI on `http://localhost:3101`

**3. Open the dashboard:**

Navigate to [http://localhost:3101](http://localhost:3101) in your browser.