import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseWatchlistRows } from '../portfolio/utils/csvParser';
import {
  fetchPriceHistory,
  fetchPriceHistorySecurities,
  postPriceHistory,
  type PriceHistoryRow,
} from '../portfolio/utils/portfolioRemote';
import { localDateString, tradingDateFromFile } from '../portfolio/utils/tradingDateFromFile';
import {
  computePriceInsights,
  priceChartData,
} from '../../shared/historyInsights';
import { usePageTitle } from '../../layouts/usePageTitle';

type SortKey =
  | 'tradingDate'
  | 'lastPrice'
  | 'highPrice'
  | 'lowPrice'
  | 'volume'
  | 'changePercent'
  | 'observedAt';

type SortDir = 'asc' | 'desc';

export function usePriceHistoryController() {
  const { setTitle } = usePageTitle();

  const [rows, setRows] = useState<PriceHistoryRow[]>([]);
  const [securities, setSecurities] = useState<string[]>([]);
  const [securityFilter, setSecurityFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [tradingDate, setTradingDateState] = useState(localDateString);
  const [tradingDateTouched, setTradingDateTouched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('tradingDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [secList, history] = await Promise.all([
        fetchPriceHistorySecurities(),
        fetchPriceHistory({
          security: securityFilter || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        }),
      ]);

      if (secList === null && history === null) {
        setApiAvailable(false);
        setRows([]);
        setSecurities([]);
        setError('Portfolio API is unavailable. Run npm run dev (API + Postgres) to load price history.');
        return;
      }

      setApiAvailable(true);
      setSecurities(secList ?? []);
      setRows(history?.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load price history');
    } finally {
      setLoading(false);
    }
  }, [securityFilter, fromDate, toDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setTitle('Price History');
    return () => setTitle(null);
  }, [setTitle]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'tradingDate' ? 'desc' : 'asc');
    }
  };

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv) * dir;
      }
      return (Number(av) - Number(bv)) * dir;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const chartRows = useMemo(() => {
    if (!securityFilter) return [];
    return priceChartData(rows);
  }, [rows, securityFilter]);

  const insightCards = useMemo(() => {
    if (!securityFilter) return [];
    return computePriceInsights(rows);
  }, [rows, securityFilter]);

  const handleWatchlistUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setError(null);
      setSuccessMessage(null);
      setUploading(true);

      try {
        const text = await file.text();
        const parsed = parseWatchlistRows(text);
        const effectiveTradingDate = tradingDateTouched
          ? tradingDate
          : tradingDateFromFile(file);
        if (!tradingDateTouched) {
          setTradingDateState(effectiveTradingDate);
        }
        const result = await postPriceHistory(parsed, effectiveTradingDate, file.name);
        if (!result.ok) {
          setError(result.error ?? 'Failed to save price history');
          return;
        }
        setSuccessMessage(
          `Saved ${result.upserted ?? parsed.length} securities for ${effectiveTradingDate} from ${file.name}`
        );
        setTradingDateTouched(false);
        await loadData();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to parse Watchlist CSV');
      } finally {
        setUploading(false);
        event.target.value = '';
      }
    },
    [tradingDate, tradingDateTouched, loadData]
  );

  const formatNum = (n?: number, decimals = 2) =>
    n != null && Number.isFinite(n)
      ? n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : '—';

  const formatObservedAt = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return {
    rows: sortedRows,
    chartRows,
    insightCards,
    securities,
    securityFilter,
    setSecurityFilter,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    tradingDate,
    setTradingDate: (date: string) => {
      setTradingDateTouched(true);
      setTradingDateState(date);
    },
    loading,
    uploading,
    apiAvailable,
    error,
    setError,
    successMessage,
    sortKey,
    sortDir,
    handleSort,
    handleWatchlistUpload,
    loadData,
    formatNum,
    formatObservedAt,
  };
}
