export default () => ({
  port: parseInt(process.env.PORT ?? '3100', 10),

  oneClick: {
    apiUrl: process.env.ONE_CLICK_API_URL ?? 'https://1click-api-staging.chaindefuser.com',
    partnerId: process.env.PARTNER_ID ?? 'pda-test-partner',
    apiKey: process.env.ONE_CLICK_API_KEY,
    timeoutMs: parseInt(process.env.ONE_CLICK_TIMEOUT_MS ?? '30000', 10),
  },

  poaBridge: {
    apiUrl: process.env.POA_BRIDGE_API_URL ?? 'https://bridge.chaindefuser.com/rpc',
  },

  explorer: {
    apiUrl: process.env.EXPLORER_API_URL ?? 'https://explorer.near-intents.org/api/v0',
  },

  defaults: {
    slippageTolerance: parseInt(process.env.DEFAULT_SLIPPAGE_TOLERANCE ?? '100', 10),
    deadlineYears: parseInt(process.env.DEFAULT_DEADLINE_YEARS ?? '10', 10),
  },
});
