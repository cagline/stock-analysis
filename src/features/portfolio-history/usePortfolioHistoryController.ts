import { useCallback, useEffect, useMemo, useState } from 'react';
import { parsePortfolioRows } from '../portfolio/utils/csvParser';
import { readPortfolioFileAsCsv } from '../portfolio/utils/readPortfolioFile';
import {
  fetchPortfolioSnapshotHistory,
  fetchPortfolioSnapshotSecurities,
  fetchPortfolioSnapshotSummary,
  postPortfolioSnapshotHistory,
  type PortfolioSnapshotRow,
  type PortfolioSnapshotSummaryRow,
} from '../portfolio/utils/portfolioRemote';
import {
  computePortfolioAggregateInsights,
  computePortfolioSecurityInsights,
  portfolioSecurityChartData,
  portfolioSummaryChartData,
} from '../../shared/historyInsights';
import { localDateString, tradingDateFromFile } from '../portfolio/utils/tradingDateFromFile';
import { usePageTitle } from '../../layouts/usePageTitle';

type SortKey =
  | 'snapshotDate'
  | 'quantity'
  | 'marketValue'
  | 'unrealizedGainLoss'
  | 'tradedPrice';

type SortDir = 'asc' | 'desc';

export function usePortfolioHistoryController() {
  const { setTitle } = usePageTitle();

  const [rows, setRows] = useState<PortfolioSnapshotRow[]>([]);
  const [summaryRows, setSummaryRows] = useState<PortfolioSnapshotSummaryRow[]>([]);
  const [securities, setSecurities] = useState<string[]>([]);
  const [securityFilter, setSecurityFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [snapshotDate, setSnapshotDateState] = useState(localDateString);
  const [snapshotDateTouched, setSnapshotDateTouched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('snapshotDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [secList, history, summary] = await Promise.all([
        fetchPortfolioSnapshotSecurities(),
        fetchPortfolioSnapshotHistory({
          security: securityFilter || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        }),
        fetchPortfolioSnapshotSummary({
          from: fromDate || undefined,
          to: toDate || undefined,
        }),
      ]);

      if (secList === null && history === null) {
        setApiAvailable(false);
        setRows([]);
        setSummaryRows([]);
        setSecurities([]);
        setError('Portfolio API is unavailable. Run npm run dev (API + Postgres) to load portfolio history.');
        return;
      }

      setApiAvailable(true);
      setSecurities(secList ?? []);
      setRows(history?.rows ?? []);
      setSummaryRows(summary?.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load portfolio history');
    } finally {
      setLoading(false);
    }
  }, [securityFilter, fromDate, toDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setTitle('Portfolio History');
    return () => setTitle(null);
  }, [setTitle]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'snapshotDate' ? 'desc' : 'asc');
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

  const securityChartData = useMemo(() => {
    if (!securityFilter) return [];
    return portfolioSecurityChartData(rows);
  }, [rows, securityFilter]);

  const aggregateChartData = useMemo(
    () => portfolioSummaryChartData(summaryRows),
    [summaryRows]
  );

  const insightCards = useMemo(() => {
    if (securityFilter) return computePortfolioSecurityInsights(rows);
    return computePortfolioAggregateInsights(summaryRows);
  }, [rows, summaryRows, securityFilter]);

  const handlePortfolioUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setError(null);
      setSuccessMessage(null);
      setUploading(true);

      try {
        const csvText = await readPortfolioFileAsCsv(file);
        const parsed = parsePortfolioRows(csvText);

        const effectiveDate = snapshotDateTouched
          ? snapshotDate
          : tradingDateFromFile(file);
        if (!snapshotDateTouched) {
          setSnapshotDateState(effectiveDate);
        }

        const result = await postPortfolioSnapshotHistory(parsed, effectiveDate, file.name);
        if (!result.ok) {
          setError(result.error ?? 'Failed to save portfolio history');
          return;
        }
        setSuccessMessage(
          `Saved ${result.upserted ?? parsed.length} securities for ${effectiveDate} from ${file.name}`
        );
        setSnapshotDateTouched(false);
        await loadData();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to parse Portfolio file');
      } finally {
        setUploading(false);
        event.target.value = '';
      }
    },
    [snapshotDate, snapshotDateTouched, loadData]
  );

  const formatNum = (n?: number, decimals = 2) =>
    n != null && Number.isFinite(n)
      ? n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : '—';

  return {
    rows: sortedRows,
    securityChartData,
    aggregateChartData,
    insightCards,
    securities,
    securityFilter,
    setSecurityFilter,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    snapshotDate,
    setSnapshotDate: (date: string) => {
      setSnapshotDateTouched(true);
      setSnapshotDateState(date);
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
    handlePortfolioUpload,
    loadData,
    formatNum,
  };
}
