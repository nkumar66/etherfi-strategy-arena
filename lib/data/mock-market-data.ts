import { MarketData } from "../types";

export function generateMockData(days: number = 90): MarketData[] {
  const data: MarketData[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days); // Start from 'days' ago

  for (let day = 0; day < days; day++) {
    // Simulate realistic APY patterns
    const baseAPY = 5.5;
    const seasonalVariation = Math.sin(day / 15) * 1.5; // ~2 week cycles
    const randomNoise = (Math.random() - 0.5) * 0.8;
    const apy = Math.max(2.5, Math.min(9.0, baseAPY + seasonalVariation + randomNoise));

    // Gas prices with weekly patterns (lower on weekends)
    const dayOfWeek = (startDate.getDay() + day) % 7;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseGas = isWeekend ? 18 : 32;
    const gasSpike = day % 7 === 1 ? 15 : 0; // Monday gas spikes
    const gasPrice = Math.max(
      12,
      baseGas + gasSpike + (Math.random() - 0.5) * 12
    );

    // TVL grows slowly with some volatility
    const tvlGrowth = (day / days) * 0.8; // Grow from 6.8B to 7.6B
    const tvlVolatility = (Math.random() - 0.5) * 0.4;
    const tvl = Math.max(6.0, 6.8 + tvlGrowth + tvlVolatility);

    // Market events (create interesting moments)
    let sentiment = "NEUTRAL";
    let trend = "STABLE";

    // Crash event around day 23
    if (day >= 23 && day <= 28) {
      sentiment = "FEAR";
      trend = "DECLINING";
    }
    // Recovery rally around day 45-52
    else if (day >= 45 && day <= 52) {
      sentiment = "GREED";
      trend = "RISING";
    }
    // Another dip around day 68-72
    else if (day >= 68 && day <= 72) {
      sentiment = "FEAR";
      trend = "DECLINING";
    }
    // Strong finish
    else if (day >= 80) {
      sentiment = "GREED";
      trend = "RISING";
    }

    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + day);

    data.push({
      day,
      date: currentDate,
      apy: parseFloat(apy.toFixed(4)),
      gasPrice: parseFloat(gasPrice.toFixed(1)),
      tvl: parseFloat(tvl.toFixed(4)),
      trend,
      sentiment,
    });
  }

  return data;
}