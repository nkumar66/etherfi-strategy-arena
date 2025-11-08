"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface ChartDataPoint {
  day: number;
  maximalist: number;
  riskManager: number;
  gasOptimizer: number;
  contrarian: number;
}

interface PerformanceChartProps {
  data: ChartDataPoint[];
}

export default function PerformanceChart({ data }: PerformanceChartProps) {
  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="day"
            label={{ value: "Day", position: "insideBottom", offset: -5 }}
            stroke="#94a3b8"
          />
          <YAxis
            label={{ value: "Portfolio (ETH)", angle: -90, position: "insideLeft" }}
            stroke="#94a3b8"
            domain={[9.99, 10.02]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "1px solid #475569",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "#e2e8f0" }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="maximalist"
            name="🔥 Maximalist"
            stroke="#ef4444"
            strokeWidth={3}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="riskManager"
            name="🛡️ Risk Manager"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="gasOptimizer"
            name="⚡ Gas Optimizer"
            stroke="#eab308"
            strokeWidth={3}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="contrarian"
            name="🎲 Contrarian"
            stroke="#a855f7"
            strokeWidth={3}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}