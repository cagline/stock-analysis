import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Point = {
  date: string;
  marketValue: number;
  totalCost: number;
};

export function PortfolioHistoryChart({ data, title }: { data: Point[]; title?: string }) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v) =>
            v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)
          }
        />
        <Tooltip
          formatter={(value) => {
            const n = Number(value);
            return Number.isFinite(n)
              ? n.toLocaleString('en-US', { maximumFractionDigits: 0 })
              : '—';
          }}
          labelFormatter={(label) => (title ? `${title} — ${label}` : label)}
        />
        <Legend />
        <Area
          type="monotone"
          dataKey="marketValue"
          name="Market value"
          fill="#1976d2"
          fillOpacity={0.15}
          stroke="#1976d2"
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="totalCost"
          name="Total cost"
          stroke="#757575"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
