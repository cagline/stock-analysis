import { useCallback, useState, useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  setOrders,
  mergeOrders,
  setError,
  selectOrders,
  selectLots,
  selectHoldings,
  selectCurrentPrices,
  selectPortfolioError,
  selectStockSplits,
  selectActionPriceRanges,
  setCurrentPrice,
  setCurrentPrices,
  addStockSplit,
  removeStockSplit,
  setStockSplits,
  setActionPriceRanges,
} from './portfolioSlice';
import { parseOrderTrackerCSV, parseWatchlistRows, parsePortfolioRows, portfolioRowsToAdjustments, parseActionPriceRangesCSV } from './utils/csvParser';
import { readPortfolioFileAsCsv } from './utils/readPortfolioFile';
import { localDateString, tradingDateFromFile } from './utils/tradingDateFromFile';
import { loadOrders as loadOrdersFromDb, saveOrders as saveOrdersToDb } from './utils/orderTrackerDb';
import { calculateRealizedGainLoss, verifySellOrders } from './utils/lotTracker';
import { exportToCSV, exportToMarkdown, exportToPDF } from './utils/exportUtils';
import { generateAllRecommendations } from './utils/recommendationEngine';
import {
  exportAIMetadata,
  exportAIMarkdown,
  exportAIMetadataForActionRanges,
  type AIExportContext,
} from './utils/aiMetadataExport';
import {
  fetchPortfolioBootstrap,
  putPortfolioOrders,
  putStockSplits,
  putSecurityPrices,
  putActionPriceRanges,
  putPortfolioAdjustments,
  postPriceHistory,
  postPortfolioSnapshotHistory,
  fetchPriceHistory,
  fetchPortfolioSnapshotSummary,
} from './utils/portfolioRemote';
import type { PortfolioSnapshotSummaryRow } from './utils/portfolioRemote';
import type { PriceHistoryPoint } from './utils/recommendationEngine';
import type { StockSplit } from './types';
import { usePageTitle } from '../../layouts/usePageTitle';

interface UploadingState {
  orders: boolean;
  watchlist: boolean;
  portfolio: boolean;
  actionRanges: boolean;
}

interface NewSplitState {
  security: string;
  splitDate: string;
  splitDateTime: string;
  ratio: number;
}

interface PortfolioData {
  salesCommission: number;
  salesProceeds: number;
  unrealizedGainLoss: number;
}

export function usePortfolioController() {
  const { setTitle } = usePageTitle();
  const dispatch = useAppDispatch();

  // Redux state
  const orders = useAppSelector(selectOrders);
  const lots = useAppSelector(selectLots);
  const holdings = useAppSelector(selectHoldings);
  const currentPrices = useAppSelector(selectCurrentPrices);
  const stockSplits = useAppSelector(selectStockSplits);
  const actionPriceRanges = useAppSelector(selectActionPriceRanges);
  const error = useAppSelector(selectPortfolioError);

  // Local state
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [selectedSecurity, setSelectedSecurity] = useState<string>('');
  const [priceInput, setPriceInput] = useState<string>('');
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [newSplit, setNewSplit] = useState<NewSplitState>({
    security: '',
    splitDate: '',
    splitDateTime: '',
    ratio: 1,
  });
  const [portfolioData, setPortfolioData] = useState<Record<string, PortfolioData>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [aiExportMenuAnchor, setAiExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [uploading, setUploading] = useState<UploadingState>({
    orders: false,
    watchlist: false,
    portfolio: false,
    actionRanges: false,
  });
  const [portfolioApiEnabled, setPortfolioApiEnabled] = useState(false);
  const [watchlistTradingDate, setWatchlistTradingDate] = useState(localDateString);
  const [watchlistTradingDateTouched, setWatchlistTradingDateTouched] = useState(false);
  const [portfolioSnapshotDate, setPortfolioSnapshotDateState] = useState(localDateString);
  const [portfolioSnapshotDateTouched, setPortfolioSnapshotDateTouched] = useState(false);
  const [priceHistoryBySecurity, setPriceHistoryBySecurity] = useState<
    Record<string, PriceHistoryPoint[]>
  >({});
  const [portfolioSnapshotSummary, setPortfolioSnapshotSummary] = useState<
    PortfolioSnapshotSummaryRow[]
  >([]);
  const [aiCopySnackOpen, setAiCopySnackOpen] = useState(false);

  // Computed values
  const recommendations = useMemo(
    () => generateAllRecommendations(holdings, actionPriceRanges, priceHistoryBySecurity),
    [holdings, actionPriceRanges, priceHistoryBySecurity]
  );
  const realizedGainLoss = calculateRealizedGainLoss(lots, portfolioData);
  const verification = verifySellOrders(lots, orders);
  const holdingsArray = Object.values(holdings).sort((a, b) =>
    a.security.localeCompare(b.security)
  );
  const totalUnrealizedGainLoss = holdingsArray.reduce(
    (sum, holding) => sum + (holding.unrealizedGainLoss || 0),
    0
  );
  const totalPortfolioValue = holdingsArray.reduce((sum, h) => sum + (h.marketValue || 0), 0);

  const aiExportContext: AIExportContext = useMemo(
    () => ({
      priceHistoryBySecurity,
      portfolioTrajectory: portfolioSnapshotSummary,
      totalPortfolioValue,
    }),
    [priceHistoryBySecurity, portfolioSnapshotSummary, totalPortfolioValue]
  );

  // File upload handlers
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      dispatch(setError(null));
      setUploading(prev => ({ ...prev, orders: true }));

      try {
        const text = await file.text();
        const parsedOrders = parseOrderTrackerCSV(text);
        dispatch(mergeOrders(parsedOrders));
      } catch (err) {
        dispatch(setError(err instanceof Error ? err.message : 'Failed to parse CSV file'));
      } finally {
        setUploading(prev => ({ ...prev, orders: false }));
        event.target.value = '';
      }
    },
    [dispatch]
  );

  const handleWatchlistUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      dispatch(setError(null));
      setUploading(prev => ({ ...prev, watchlist: true }));

      try {
        const text = await file.text();
        const rows = parseWatchlistRows(text);
        const tradingDate = watchlistTradingDateTouched
          ? watchlistTradingDate
          : tradingDateFromFile(file);
        if (!watchlistTradingDateTouched) {
          setWatchlistTradingDate(tradingDate);
        }
        const priceMap: Record<string, number> = {};
        for (const row of rows) {
          priceMap[row.security] = row.lastPrice;
        }
        dispatch(setCurrentPrices(priceMap));

        if (portfolioApiEnabled) {
          const result = await postPriceHistory(rows, tradingDate, file.name);
          if (!result.ok) {
            dispatch(
              setError(
                result.error
                  ? `Prices updated locally; history save failed: ${result.error}`
                  : 'Prices updated locally; history save failed'
              )
            );
          }
        }
        setWatchlistTradingDateTouched(false);
      } catch (err) {
        dispatch(setError(err instanceof Error ? err.message : 'Failed to parse Watchlist CSV file'));
      } finally {
        setUploading(prev => ({ ...prev, watchlist: false }));
        event.target.value = '';
      }
    },
    [dispatch, portfolioApiEnabled, watchlistTradingDate, watchlistTradingDateTouched]
  );

  const handlePortfolioUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      dispatch(setError(null));
      setUploading(prev => ({ ...prev, portfolio: true }));

      try {
        const csvText = await readPortfolioFileAsCsv(file);
        const rows = parsePortfolioRows(csvText);
        const data = portfolioRowsToAdjustments(rows);
        setPortfolioData(data);

        const snapshotDate = portfolioSnapshotDateTouched
          ? portfolioSnapshotDate
          : tradingDateFromFile(file);
        if (!portfolioSnapshotDateTouched) {
          setPortfolioSnapshotDateState(snapshotDate);
        }

        if (portfolioApiEnabled) {
          const result = await postPortfolioSnapshotHistory(rows, snapshotDate, file.name);
          if (!result.ok) {
            dispatch(
              setError(
                result.error
                  ? `Portfolio loaded locally; history save failed: ${result.error}`
                  : 'Portfolio loaded locally; history save failed'
              )
            );
          }
        }
        setPortfolioSnapshotDateTouched(false);
      } catch (err) {
        dispatch(setError(err instanceof Error ? err.message : 'Failed to parse Portfolio file'));
      } finally {
        setUploading(prev => ({ ...prev, portfolio: false }));
        event.target.value = '';
      }
    },
    [dispatch, portfolioApiEnabled, portfolioSnapshotDate, portfolioSnapshotDateTouched]
  );

  const handleActionPriceRangesUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      dispatch(setError(null));
      setUploading(prev => ({ ...prev, actionRanges: true }));

      try {
        const text = await file.text();
        const ranges = parseActionPriceRangesCSV(text);
        dispatch(setActionPriceRanges(ranges));
      } catch (err) {
        dispatch(setError(err instanceof Error ? err.message : 'Failed to parse Action Price Ranges CSV file'));
      } finally {
        setUploading(prev => ({ ...prev, actionRanges: false }));
        event.target.value = '';
      }
    },
    [dispatch]
  );

  // Price dialog handlers
  const handlePriceUpdate = () => {
    const price = parseFloat(priceInput);
    if (!isNaN(price) && price > 0) {
      dispatch(setCurrentPrice({ security: selectedSecurity, price }));
      setPriceDialogOpen(false);
      setPriceInput('');
      setSelectedSecurity('');
    }
  };

  const openPriceDialog = (security: string, currentPrice?: number) => {
    setSelectedSecurity(security);
    setPriceInput(currentPrice?.toString() || '');
    setPriceDialogOpen(true);
  };

  const closePriceDialog = () => {
    setPriceDialogOpen(false);
    setPriceInput('');
    setSelectedSecurity('');
  };

  // Stock split handlers
  const handleAddStockSplit = () => {
    if (newSplit.security && newSplit.splitDate && newSplit.ratio > 0) {
      const split: StockSplit = {
        id: `split-${Date.now()}`,
        security: newSplit.security,
        splitDate: newSplit.splitDate,
        splitDateTime: newSplit.splitDateTime || `${newSplit.splitDate} 00:00:00`,
        ratio: newSplit.ratio,
      };

      dispatch(addStockSplit(split));
      setSplitDialogOpen(false);
      setNewSplit({ security: '', splitDate: '', splitDateTime: '', ratio: 1 });
    }
  };

  const openSplitDialog = (security: string) => {
    setNewSplit({
      security,
      splitDate: '',
      splitDateTime: '',
      ratio: 1
    });
    setSplitDialogOpen(true);
  };

  const closeSplitDialog = () => {
    setSplitDialogOpen(false);
    setNewSplit({ security: '', splitDate: '', splitDateTime: '', ratio: 1 });
  };

  const handleRemoveSplit = (splitId: string) => {
    dispatch(removeStockSplit(splitId));
  };

  // Export handlers
  const handleExportCSV = () => {
    exportToCSV(holdings, stockSplits);
    setExportMenuAnchor(null);
  };

  const handleExportMarkdown = () => {
    exportToMarkdown(holdings, stockSplits);
    setExportMenuAnchor(null);
  };

  const handleExportPDF = () => {
    exportToPDF(holdings, stockSplits);
    setExportMenuAnchor(null);
  };

  const handleExportAIActionRanges = () => {
    const metadata = exportAIMetadataForActionRanges(holdings, aiExportContext);
    const blob = new Blob([metadata], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `portfolio-action-ranges-request-${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setAiExportMenuAnchor(null);
  };

  const handleExportAIMetadata = () => {
    const metadata = exportAIMetadata(
      holdings,
      recommendations,
      actionPriceRanges,
      aiExportContext
    );
    const blob = new Blob([metadata], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `portfolio-ai-metadata-${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setAiExportMenuAnchor(null);
  };

  const handleExportAIMarkdown = () => {
    const markdown = exportAIMarkdown(
      holdings,
      recommendations,
      actionPriceRanges,
      aiExportContext
    );
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `portfolio-ai-analysis-${new Date().toISOString().split('T')[0]}.md`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setAiExportMenuAnchor(null);
  };

  const handleCopyAIMarkdown = async () => {
    const markdown = exportAIMarkdown(
      holdings,
      recommendations,
      actionPriceRanges,
      aiExportContext
    );
    try {
      await navigator.clipboard.writeText(markdown);
      setAiCopySnackOpen(true);
    } catch {
      const blob = new Blob([markdown], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
    setAiExportMenuAnchor(null);
  };

  // Effects — Portfolio API + Postgres (Vite proxies /api → portfolio-api), or IndexedDB / localStorage
  useEffect(() => {
    let cancelled = false;

    const loadLocalFallback = () => {
      const savedSplits = localStorage.getItem('portfolio_stockSplits');
      if (savedSplits) {
        try {
          const parsed = JSON.parse(savedSplits);
          if (Array.isArray(parsed) && parsed.length > 0) {
            dispatch(setStockSplits(parsed));
          }
        } catch (e) {
          console.error('Failed to load saved stock splits', e);
        }
      }
      loadOrdersFromDb()
        .then((saved) => {
          if (saved.length > 0) {
            dispatch(setOrders(saved));
          }
        })
        .catch((e) => console.error('Failed to load orders from IndexedDB', e));
    };

    (async () => {
      const boot = await fetchPortfolioBootstrap();
      if (cancelled) return;
      if (!boot) {
        loadLocalFallback();
        return;
      }

      const nextOrders = Array.isArray(boot.orders) ? boot.orders : [];
      dispatch(setOrders(nextOrders));

      const nextSplits = Array.isArray(boot.stockSplits) ? boot.stockSplits : [];
      if (nextSplits.length > 0) {
        dispatch(setStockSplits(nextSplits));
      }

      if (boot.currentPrices && Object.keys(boot.currentPrices).length > 0) {
        dispatch(setCurrentPrices(boot.currentPrices));
      }
      if (boot.actionPriceRanges && Object.keys(boot.actionPriceRanges).length > 0) {
        dispatch(setActionPriceRanges(boot.actionPriceRanges));
      }
      if (boot.portfolioAdjustments && Object.keys(boot.portfolioAdjustments).length > 0) {
        setPortfolioData(boot.portfolioAdjustments);
      }

      if (nextOrders.length === 0) {
        const localOrders = await loadOrdersFromDb();
        if (!cancelled && localOrders.length > 0) {
          dispatch(setOrders(localOrders));
          await putPortfolioOrders(localOrders);
        }
      }

      if (nextSplits.length === 0) {
        const raw = localStorage.getItem('portfolio_stockSplits');
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as StockSplit[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              if (!cancelled) {
                dispatch(setStockSplits(parsed));
                await putStockSplits(parsed);
              }
            }
          } catch {
            /* ignore */
          }
        }
      }

      if (!cancelled) {
        setPortfolioApiEnabled(true);
      }
    })().catch(() => {
      if (!cancelled) loadLocalFallback();
    });

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useEffect(() => {
    if (!portfolioApiEnabled) {
      saveOrdersToDb(orders).catch((e) => console.error('Failed to save orders to IndexedDB', e));
      return;
    }
    const t = window.setTimeout(() => {
      putPortfolioOrders(orders).catch((e) => console.error('Failed to sync orders to API', e));
    }, 500);
    return () => window.clearTimeout(t);
  }, [orders, portfolioApiEnabled]);

  useEffect(() => {
    if (!portfolioApiEnabled) {
      if (stockSplits.length > 0) {
        localStorage.setItem('portfolio_stockSplits', JSON.stringify(stockSplits));
      } else {
        localStorage.removeItem('portfolio_stockSplits');
      }
      return;
    }
    const t = window.setTimeout(() => {
      putStockSplits(stockSplits).catch((e) => console.error('Failed to sync stock splits to API', e));
    }, 500);
    return () => window.clearTimeout(t);
  }, [stockSplits, portfolioApiEnabled]);

  useEffect(() => {
    if (!portfolioApiEnabled) return;
    const t = window.setTimeout(() => {
      putSecurityPrices(currentPrices).catch((e) => console.error('Failed to sync prices to API', e));
    }, 500);
    return () => window.clearTimeout(t);
  }, [currentPrices, portfolioApiEnabled]);

  useEffect(() => {
    if (!portfolioApiEnabled) return;
    const t = window.setTimeout(() => {
      putActionPriceRanges(actionPriceRanges).catch((e) =>
        console.error('Failed to sync action ranges to API', e)
      );
    }, 500);
    return () => window.clearTimeout(t);
  }, [actionPriceRanges, portfolioApiEnabled]);

  useEffect(() => {
    if (!portfolioApiEnabled) return;
    const t = window.setTimeout(() => {
      putPortfolioAdjustments(portfolioData).catch((e) =>
        console.error('Failed to sync portfolio adjustments to API', e)
      );
    }, 500);
    return () => window.clearTimeout(t);
  }, [portfolioData, portfolioApiEnabled]);

  useEffect(() => {
    if (!portfolioApiEnabled) {
      setPriceHistoryBySecurity({});
      setPortfolioSnapshotSummary([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [priceData, summaryData] = await Promise.all([
        fetchPriceHistory({ limit: 10000 }),
        fetchPortfolioSnapshotSummary(),
      ]);
      if (cancelled) return;
      if (priceData?.rows) {
        const map: Record<string, PriceHistoryPoint[]> = {};
        for (const row of priceData.rows) {
          if (!map[row.security]) map[row.security] = [];
          map[row.security].push({
            tradingDate: row.tradingDate,
            lastPrice: row.lastPrice,
          });
        }
        setPriceHistoryBySecurity(map);
      } else {
        setPriceHistoryBySecurity({});
      }
      setPortfolioSnapshotSummary(summaryData?.rows ?? []);
    })().catch(() => {
      if (!cancelled) {
        setPriceHistoryBySecurity({});
        setPortfolioSnapshotSummary([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [portfolioApiEnabled]);

  // Set page title
  useEffect(() => {
    setTitle('Stock Portfolio Analysis');
    return () => setTitle(null);
  }, [setTitle]);

  return {
    // Redux state
    orders,
    lots,
    holdings,
    currentPrices,
    stockSplits,
    actionPriceRanges,
    error,

    // Computed values
    recommendations,
    realizedGainLoss,
    verification,
    holdingsArray,
    totalUnrealizedGainLoss,
    totalPortfolioValue,

    // Local state
    priceDialogOpen,
    selectedSecurity,
    priceInput,
    setPriceInput,
    splitDialogOpen,
    newSplit,
    setNewSplit,
    portfolioData,
    searchQuery,
    setSearchQuery,
    exportMenuAnchor,
    setExportMenuAnchor,
    aiExportMenuAnchor,
    setAiExportMenuAnchor,
    uploading,
    watchlistTradingDate,
    setWatchlistTradingDate: (date: string) => {
      setWatchlistTradingDateTouched(true);
      setWatchlistTradingDate(date);
    },
    portfolioSnapshotDate,
    setPortfolioSnapshotDate: (date: string) => {
      setPortfolioSnapshotDateTouched(true);
      setPortfolioSnapshotDateState(date);
    },

    // Handlers
    handleFileUpload,
    handleWatchlistUpload,
    handlePortfolioUpload,
    handleActionPriceRangesUpload,
    handlePriceUpdate,
    openPriceDialog,
    closePriceDialog,
    handleAddStockSplit,
    openSplitDialog,
    closeSplitDialog,
    handleRemoveSplit,
    handleExportCSV,
    handleExportMarkdown,
    handleExportPDF,
    handleExportAIActionRanges,
    handleExportAIMetadata,
    handleExportAIMarkdown,
    handleCopyAIMarkdown,
    aiCopySnackOpen,
    setAiCopySnackOpen,
  };
}
