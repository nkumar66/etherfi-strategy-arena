"use client";

import { useState } from "react";
import { Calculator, TrendingUp, AlertTriangle, Loader2, Zap } from "lucide-react";

interface StrategyResult {
  netAPY: number;
  grossAPY: number;
  gasCost: number;
  risk: string;
  analysis: string;
}

export default function StrategyBuilder() {
  const [collateral, setCollateral] = useState(10);
  const [borrowToken, setBorrowToken] = useState("USDC");
  const [borrowRate, setBorrowRate] = useState(5);
  const [lendToken, setLendToken] = useState("USDC");
  const [lendRate, setLendRate] = useState(10);
  const [leverage, setLeverage] = useState(3);
  const [chain, setChain] = useState("ethereum");
  const [gasPrice, setGasPrice] = useState(30);
  
  const [result, setResult] = useState<StrategyResult | null>(null);
  const [loading, setLoading] = useState(false);

  const calculateQuick = () => {
    const weETHBase = 3.0;
    const netSpread = lendRate - borrowRate;
    const grossAPY = weETHBase + netSpread * (leverage - 1);
    
    // Gas cost estimation
    const txCount = leverage * 2; // 2 tx per loop
    const gasCostPerTx = (gasPrice / 1000) * 0.002;
    const totalGasCost = gasCostPerTx * txCount;
    const annualizedGas = (totalGasCost / collateral) * 12 * 100;
    
    const netAPY = grossAPY - annualizedGas;
    
    let risk = "LOW";
    if (leverage >= 7) risk = "EXTREME";
    else if (leverage >= 5) risk = "HIGH";
    else if (leverage >= 3) risk = "MEDIUM";
    
    return { netAPY, grossAPY, gasCost: totalGasCost, risk };
  };

  const analyzeStrategy = async () => {
    setLoading(true);
    
    try {
      const response = await fetch("/api/analyze-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collateral,
          borrowToken,
          borrowRate,
          lendToken,
          lendRate,
          leverage,
          chain,
          gasPrice,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        const quick = calculateQuick();
        setResult({
          ...quick,
          analysis: data.analysis,
        });
      } else {
        alert("Analysis failed: " + data.error);
      }
    } catch (error) {
      console.error("Analysis error:", error);
      alert("Failed to analyze strategy");
    } finally {
      setLoading(false);
    }
  };

  const quickCalc = calculateQuick();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-5xl font-bold text-white mb-4">
            🧮 Custom Strategy Builder
          </h2>
          <p className="text-xl text-slate-300">
            Design your own EtherFi yield strategy and get AI-powered analysis
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Panel */}
          <div className="bg-slate-800/50 backdrop-blur-sm border-2 border-slate-700 rounded-2xl p-6 space-y-6">
            <h3 className="text-2xl font-bold text-white mb-4">Strategy Parameters</h3>
            
            {/* Collateral */}
            <div>
              <label className="text-slate-300 text-sm font-semibold mb-2 block">
                Collateral Amount (weETH)
              </label>
              <input
                type="number"
                value={collateral}
                onChange={(e) => setCollateral(Number(e.target.value))}
                className="w-full bg-slate-700 text-white rounded-lg p-3 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                min="0.1"
                step="0.1"
              />
            </div>

            {/* Chain Selection */}
            <div>
              <label className="text-slate-300 text-sm font-semibold mb-2 block">
                Blockchain Network
              </label>
              <select
                value={chain}
                onChange={(e) => setChain(e.target.value)}
                className="w-full bg-slate-700 text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="ethereum">Ethereum (Mainnet)</option>
                <option value="base">Base (L2)</option>
                <option value="arbitrum">Arbitrum (L2)</option>
              </select>
            </div>

            {/* Borrow Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 text-sm font-semibold mb-2 block">
                  Borrow Token
                </label>
                <select
                  value={borrowToken}
                  onChange={(e) => setBorrowToken(e.target.value)}
                  className="w-full bg-slate-700 text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ETH">ETH</option>
                  <option value="USDC">USDC</option>
                  <option value="USDT">USDT</option>
                  <option value="DAI">DAI</option>
                  <option value="PYUSD">PYUSD</option>
                  <option value="RLUSD">RLUSD</option>
                </select>
              </div>
              <div>
                <label className="text-slate-300 text-sm font-semibold mb-2 block">
                  Borrow APY (%)
                </label>
                <input
                  type="number"
                  value={borrowRate}
                  onChange={(e) => setBorrowRate(Number(e.target.value))}
                  className="w-full bg-slate-700 text-white rounded-lg p-3 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                  step="0.1"
                  min="0"
                />
              </div>
            </div>

            {/* Lend Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 text-sm font-semibold mb-2 block">
                  Lend Token
                </label>
                <select
                  value={lendToken}
                  onChange={(e) => setLendToken(e.target.value)}
                  className="w-full bg-slate-700 text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ETH">ETH</option>
                  <option value="USDC">USDC</option>
                  <option value="USDT">USDT</option>
                  <option value="DAI">DAI</option>
                  <option value="PYUSD">PYUSD</option>
                  <option value="RLUSD">RLUSD</option>
                </select>
              </div>
              <div>
                <label className="text-slate-300 text-sm font-semibold mb-2 block">
                  Lend APY (%)
                </label>
                <input
                  type="number"
                  value={lendRate}
                  onChange={(e) => setLendRate(Number(e.target.value))}
                  className="w-full bg-slate-700 text-white rounded-lg p-3 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                  step="0.1"
                  min="0"
                />
              </div>
            </div>

            {/* Leverage Slider */}
            <div>
              <label className="text-slate-300 text-sm font-semibold mb-2 block">
                Leverage: <span className="text-purple-400">{leverage}x</span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value))}
                className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer slider-thumb"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>1x (Safe)</span>
                <span>5x (Balanced)</span>
                <span>10x (Risky)</span>
              </div>
            </div>

            {/* Gas Price */}
            <div>
              <label className="text-slate-300 text-sm font-semibold mb-2 block">
                Estimated Gas Price: <span className="text-orange-400">{gasPrice} gwei</span>
              </label>
              <input
                type="range"
                min="10"
                max="100"
                value={gasPrice}
                onChange={(e) => setGasPrice(Number(e.target.value))}
                className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <button
              onClick={analyzeStrategy}
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing with Claude...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Get AI Analysis
                </>
              )}
            </button>
          </div>

          {/* Results Panel */}
          <div className="space-y-6">
            {/* Quick Results */}
            <div className="bg-slate-800/50 backdrop-blur-sm border-2 border-slate-700 rounded-2xl p-6">
              <h3 className="text-2xl font-bold text-white mb-4">Quick Calculation</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-400 mb-2">
                    <TrendingUp className="w-5 h-5" />
                    <span className="text-sm">Net APY</span>
                  </div>
                  <div className="text-3xl font-bold text-white">
                    {quickCalc.netAPY.toFixed(2)}%
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-blue-400 mb-2">
                    <Calculator className="w-5 h-5" />
                    <span className="text-sm">Gross APY</span>
                  </div>
                  <div className="text-3xl font-bold text-white">
                    {quickCalc.grossAPY.toFixed(2)}%
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-orange-400 mb-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="text-sm">Risk Level</span>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {quickCalc.risk}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-purple-400 mb-2">
                    <Zap className="w-5 h-5" />
                    <span className="text-sm">Gas Cost</span>
                  </div>
                  <div className="text-xl font-bold text-white font-mono">
                    Ξ {quickCalc.gasCost.toFixed(4)}
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-2">Strategy Summary</h4>
                <ul className="text-sm text-slate-400 space-y-1">
                  <li>• Supply {collateral} weETH as collateral on {chain}</li>
                  <li>• Borrow {borrowToken} at {borrowRate}% APY</li>
                  <li>• Lend {lendToken} at {lendRate}% APY</li>
                  <li>• Apply {leverage}x leverage</li>
                  <li>• Net spread: {(lendRate - borrowRate).toFixed(2)}% per loop</li>
                </ul>
              </div>
            </div>

            {/* AI Analysis */}
            {result && result.analysis && (
              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/50 rounded-2xl p-6">
                <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <Zap className="w-6 h-6 text-purple-400" />
                  Claude&apos;s Analysis
                </h3>
                <div className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {result.analysis}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}