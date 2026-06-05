import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Point = {
  date: string;
  last: number;
  high?: number;
  low?: number;
};

export function PriceHistoryChart({ data }: { data: Point[] }) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
        <Tooltip
          formatter={(value) => {
            const n = Number(value);
            return Number.isFinite(n)
              ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : '—';
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="last"
          name="Last"
          stroke="#1976d2"
          strokeWidth={2}
          dot={{ r: 4 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="high"
          name="High"
          stroke="#2e7d32"
          strokeWidth={1}
          strokeDasharray="4 4"
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="low"
          name="Low"
          stroke="#d32f2f"
          strokeWidth={1}
          strokeDasharray="4 4"
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
