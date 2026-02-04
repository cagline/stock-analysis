import { useCallback, useState, useEffect } from 'react';
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
import { parseOrderTrackerCSV, parseWatchlistCSV, parsePortfolioCSV, parseActionPriceRangesCSV } from './utils/csvParser';
import { loadOrders as loadOrdersFromDb, saveOrders as saveOrdersToDb } from './utils/orderTrackerDb';
import { calculateRealizedGainLoss, verifySellOrders } from './utils/lotTracker';
import { exportToCSV, exportToMarkdown, exportToPDF } from './utils/exportUtils';
import { generateAllRecommendations } from './utils/recommendationEngine';
import { exportAIMetadata, exportAIMarkdown, exportAIMetadataForActionRanges } from './utils/aiMetadataExport';
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

  // Computed values
  const recommendations = generateAllRecommendations(holdings, actionPriceRanges);
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
        const priceMap = parseWatchlistCSV(text);
        dispatch(setCurrentPrices(priceMap));
      } catch (err) {
        dispatch(setError(err instanceof Error ? err.message : 'Failed to parse Watchlist CSV file'));
      } finally {
        setUploading(prev => ({ ...prev, watchlist: false }));
        event.target.value = '';
      }
    },
    [dispatch]
  );

  const handlePortfolioUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      dispatch(setError(null));
      setUploading(prev => ({ ...prev, portfolio: true }));

      try {
        const text = await file.text();
        const data = parsePortfolioCSV(text);
        setPortfolioData(data);
      } catch (err) {
        dispatch(setError(err instanceof Error ? err.message : 'Failed to parse Portfolio CSV file'));
      } finally {
        setUploading(prev => ({ ...prev, portfolio: false }));
        event.target.value = '';
      }
    },
    [dispatch]
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
    const metadata = exportAIMetadataForActionRanges(holdings, totalPortfolioValue);
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
    const metadata = exportAIMetadata(holdings, recommendations, actionPriceRanges, totalPortfolioValue);
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
    const markdown = exportAIMarkdown(holdings, recommendations, actionPriceRanges, totalPortfolioValue);
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

  // Effects
  // Load stock splits from localStorage on mount
  useEffect(() => {
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
  }, [dispatch]);

  // Load Order Tracker from IndexedDB on mount
  useEffect(() => {
    loadOrdersFromDb()
      .then((saved) => {
        if (saved.length > 0) {
          dispatch(setOrders(saved));
        }
      })
      .catch((e) => console.error('Failed to load orders from IndexedDB', e));
  }, [dispatch]);

  // Save stock splits to localStorage whenever they change
  useEffect(() => {
    if (stockSplits.length > 0) {
      localStorage.setItem('portfolio_stockSplits', JSON.stringify(stockSplits));
    } else {
      localStorage.removeItem('portfolio_stockSplits');
    }
  }, [stockSplits]);

  // Save Order Tracker to IndexedDB whenever orders change
  useEffect(() => {
    saveOrdersToDb(orders).catch((e) => console.error('Failed to save orders to IndexedDB', e));
  }, [orders]);

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
  };
}
