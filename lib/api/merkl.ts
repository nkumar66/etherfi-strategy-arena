// lib/data/merkl.ts
// Fetches incentive opportunities from the Merkl API (v4)
// and normalizes them into a clean, strongly typed structure.

export interface MerklRawOpportunity {
  id?: string;
  opportunityId?: string;
  protocol?: string | { name: string };
  token?: { symbol?: string };
  asset?: { symbol?: string };
  mainAsset?: string;
  symbol?: string;
  apr?: number | string;
  incentiveApr?: number | string;
  apy?: number | string;
  chainId?: number | string;
  chain?: { id?: number | string };
  network?: string;
  tvlUsd?: number | string;
  tvl?: number | string;
  rewardToken?: string | { symbol?: string };
  url?: string;
  link?: string;
}

export interface MerklOpportunity {
  id: string;
  protocol: string;
  token: string;
  apr: number;       // Incentive APR %
  network: string;
  tvlUsd: number;
  rewardToken?: string;
  url?: string;
}

const MERKL_BASE = "https://api.merkl.xyz/v4";

/**
 * Converts a chainId into a readable chain name.
 */
function chainName(chainId?: number | string): string {
  const map: Record<string, string> = {
    "1": "Ethereum",
    "8453": "Base",
    "42161": "Arbitrum",
    "137": "Polygon",
  };
  return chainId != null ? map[String(chainId)] ?? `Chain ${chainId}` : "Unknown";
}

/**
 * Safely converts a numeric-like value to number.
 */
function num(value: number | string | undefined): number {
  if (value === undefined) return 0;
  const parsed = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Fetches Merkl opportunities from the API (v4).
 */
export async function getMerklOpportunities(params?: {
  chainId?: number | string;
  protocol?: string;
  tokenSymbol?: string;
  page?: number;
}): Promise<MerklOpportunity[]> {
  try {
    // Build query string
    const qs = new URLSearchParams();
    if (params?.chainId) qs.set("chainId", String(params.chainId));
    if (params?.protocol) qs.set("protocol", params.protocol);
    if (params?.tokenSymbol) qs.set("tokenSymbol", params.tokenSymbol);
    if (params?.page !== undefined) qs.set("page", String(params.page));

    const url = `${MERKL_BASE}/opportunities${qs.toString() ? "?" + qs.toString() : ""}`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Merkl API error ${res.status}: ${errText}`);
      return [];
    }

    const data: unknown = await res.json();

    // Some versions of the API wrap results inside an "items" array
    const list: MerklRawOpportunity[] =
      Array.isArray(data)
        ? (data as MerklRawOpportunity[])
        : Array.isArray((data as { items?: MerklRawOpportunity[] })?.items)
        ? ((data as { items: MerklRawOpportunity[] }).items)
        : [];

    const opportunities: MerklOpportunity[] = list
      .map((d: MerklRawOpportunity): MerklOpportunity => {
        const protocolName =
          typeof d.protocol === "string"
            ? d.protocol
            : d.protocol?.name ?? "Unknown";

        const tokenSymbol =
          d.token?.symbol ??
          d.asset?.symbol ??
          d.symbol ??
          d.mainAsset ??
          "Unknown";

        const aprValue = num(d.apr ?? d.incentiveApr ?? d.apy);
        const networkName = chainName(d.chainId ?? d.chain?.id ?? d.network);
        const tvlValue = num(d.tvlUsd ?? d.tvl);

        const rewardSymbol =
          typeof d.rewardToken === "string"
            ? d.rewardToken
            : d.rewardToken?.symbol;

        const link = d.url ?? d.link ?? "";

        return {
          id: d.id ?? d.opportunityId ?? `${protocolName}-${tokenSymbol}`,
          protocol: protocolName,
          token: tokenSymbol,
          apr: aprValue,
          network: networkName,
          tvlUsd: tvlValue,
          rewardToken: rewardSymbol,
          url: link,
        };
      })
      .filter((o) => o.apr > 0);

    return opportunities.sort((a, b) => b.apr - a.apr).slice(0, 20);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Merkl fetch failed:", message);
    return [];
  }
}

/**
 * Fallback data when Merkl API is unavailable.
 */
export function getFallbackMerklData(): MerklOpportunity[] {
  return [
    {
      id: "aave-usdt-eth",
      protocol: "Aave",
      token: "USDT",
      apr: 3.24,
      network: "Ethereum",
      tvlUsd: 15_000_000,
      rewardToken: "XPL",
      url: "https://app.merkl.xyz/opportunities/plasma/MULTILOG_DUTCH/0xf19a735a7b5a2ed6a21417d87d6c8f4c1a189834",
    },
    {
      id: "aave-usdc-base",
      protocol: "Aave",
      token: "USDC",
      apr: 4.12,
      network: "Base",
      tvlUsd: 8_500_000,
      rewardToken: "OP",
      url: "https://app.merkl.xyz",
    },
    {
      id: "aave-weth-arb",
      protocol: "Aave",
      token: "WETH",
      apr: 2.85,
      network: "Arbitrum",
      tvlUsd: 22_000_000,
      rewardToken: "ARB",
      url: "https://app.merkl.xyz",
    },
  ];
}
