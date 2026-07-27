"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ─── Shared tooltip style ──────────────────────────────────────────────────

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "12px",
    fontSize: "12px",
    color: "var(--color-foreground)",
  },
  cursor: { fill: "var(--color-accent)" },
};

// ─── Revenue Area Chart ────────────────────────────────────────────────────

interface RevenueData {
  month: string;
  volume: number;
  revenue: number;
}

export function RevenueAreaChart({ data }: { data: RevenueData[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="volume"
          name="Volume ($)"
          stroke="var(--color-primary)"
          strokeWidth={2}
          fill="url(#volumeGradient)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Revenue ($)"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#revenueGradient)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Orders Bar Chart ──────────────────────────────────────────────────────

interface OrdersData {
  month: string;
  completed: number;
  pending: number;
  refunded: number;
}

export function OrdersBarChart({ data }: { data: OrdersData[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        <Bar dataKey="refunded" name="Refunded" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Earnings Line Chart ───────────────────────────────────────────────────

interface EarningsData {
  month: string;
  gross: number;
  net: number;
}

export function EarningsLineChart({ data }: { data: EarningsData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="gross"
          name="Gross ($)"
          stroke="var(--color-primary)"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="net"
          name="Net ($)"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Category Pie Chart ────────────────────────────────────────────────────

interface PieData {
  name: string;
  value: number;
  color: string;
}

export function CategoryPieChart({ data }: { data: PieData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "12px",
            fontSize: "12px",
            color: "var(--color-foreground)",
          }}
          formatter={(value) => [`${value}%`, ""]}
        />
        <Legend
          formatter={(value) => (
            <span style={{ fontSize: 12, color: "var(--color-muted-foreground)" }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Users Growth Line Chart ───────────────────────────────────────────────

interface UsersData {
  month: string;
  farmers: number;
  buyers: number;
}

export function UsersGrowthChart({ data }: { data: UsersData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="farmersGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="buyersGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="farmers"
          name="Farmers"
          stroke="var(--color-primary)"
          strokeWidth={2}
          fill="url(#farmersGradient)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="buyers"
          name="Buyers"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#buyersGradient)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Price Index / Forecast Chart ──────────────────────────────────────────

interface PriceIndexPoint {
  period: string;
  price: number;
  forecast?: number | null;
  movingAvg?: number | null;
}

export function PriceForecastChart({ data }: { data: PriceIndexPoint[] }) {
  if (!data.length) {
    return (
      <div className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">
        No price-index data for this region yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="period" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="price"
          name="Price index"
          stroke="var(--color-primary)"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="movingAvg"
          name="7-period MA"
          stroke="#8b5cf6"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="forecast"
          name="Forecast"
          stroke="#10b981"
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={{ r: 3 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Seasonal Yield Chart ──────────────────────────────────────────────────

interface YieldPoint {
  season: string;
  estimated: number;
  actual?: number | null;
}

export function YieldEstimateChart({ data }: { data: YieldPoint[] }) {
  if (!data.length) {
    return (
      <div className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">
        No yield estimates available for this crop/region.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="season" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="estimated" name="Estimated yield" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="actual" name="Actual yield" fill="#10b981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
