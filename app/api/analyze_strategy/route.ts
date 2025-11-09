import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  try {
    const {
      collateral,
      borrowToken,
      borrowRate,
      lendToken,
      lendRate,
      leverage,
      chain,
      gasPrice,
    } = await req.json();

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    const weETHBase = 3.0;
    const netSpread = lendRate - borrowRate;
    const grossAPY = weETHBase + netSpread * (leverage - 1);
    const txCount = leverage * 2;
    const gasCostPerTx = (gasPrice / 1000) * 0.002;
    const totalGasCost = gasCostPerTx * txCount;
    const annualizedGas = (totalGasCost / collateral) * 12 * 100;
    const netAPY = grossAPY - annualizedGas;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `Analyze this EtherFi weETH DeFi strategy:

STRATEGY DETAILS:
- Collateral: ${collateral} weETH
- Chain: ${chain}
- Borrow: ${borrowToken} at ${borrowRate}% APY
- Lend: ${lendToken} at ${lendRate}% APY
- Leverage: ${leverage}x
- Gas Price: ${gasPrice} gwei

CALCULATED RETURNS:
- Gross APY: ${grossAPY.toFixed(2)}%
- Gas Costs: ${annualizedGas.toFixed(2)}% annually
- Net APY: ${netAPY.toFixed(2)}%

PROVIDE ANALYSIS:
1. Risk Assessment (liquidation risk, rate volatility, protocol risks)
2. Optimal Market Conditions (when this strategy works best)
3. Key Warnings & Recommendations
4. Comparison to simpler alternatives

Keep it concise (4-5 paragraphs), practical, and specific to this strategy.`,
        },
      ],
    });

    const analysis = message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    console.error("Strategy analysis error:", error);
    return NextResponse.json(
      { success: false, error: "Analysis failed" },
      { status: 500 }
    );
  }
}