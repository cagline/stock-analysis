import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
  Paper,
} from '@mui/material';
import { CloudUpload as CloudUploadIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { ChartPanel, InsightCards } from '../../shared/InsightCards';
import { PriceHistoryChart } from '../../shared/PriceHistoryChart';
import { usePriceHistoryController } from './usePriceHistoryController';

const PriceHistoryPage: React.FC = () => {
  const {
    rows,
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
    setTradingDate,
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
  } = usePriceHistoryController();

  return (
    <Container maxWidth={false} sx={{ py: 4, px: { xs: 2, sm: 3, md: 4 }, maxWidth: '1920px', width: '100%' }}>
      <Typography variant="h5" gutterBottom>
        Price History
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Daily watchlist snapshots — one row per security per trading date. Upload the same CSV format as Portfolio.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Upload Watchlist
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end' }}>
            <TextField
              label="Trading date"
              type="date"
              size="small"
              value={tradingDate}
              onChange={(e) => setTradingDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="Defaults to the file's saved date on upload. Edit before uploading to override."
              sx={{ minWidth: 280 }}
            />
            <Box
              component="input"
              accept=".csv"
              sx={{ display: 'none' }}
              id="price-history-watchlist-input"
              type="file"
              onChange={handleWatchlistUpload}
              disabled={uploading || !apiAvailable}
            />
            <label htmlFor="price-history-watchlist-input">
              <Button
                variant="contained"
                component="span"
                startIcon={<CloudUploadIcon />}
                disabled={uploading || !apiAvailable}
              >
                {uploading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={18} color="inherit" />
                    Uploading...
                  </Box>
                ) : (
                  'Upload Watchlist CSV'
                )}
              </Button>
            </label>
          </Box>
          {!apiAvailable && !loading && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Start Postgres and the portfolio API (npm run dev) to upload and view history.
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end' }}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="security-filter-label">Security</InputLabel>
              <Select
                labelId="security-filter-label"
                label="Security"
                value={securityFilter}
                onChange={(e) => setSecurityFilter(e.target.value)}
              >
                <MenuItem value="">All securities</MenuItem>
                {securities.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="From"
              type="date"
              size="small"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="To"
              type="date"
              size="small"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => loadData()} disabled={loading}>
              Refresh
            </Button>
          </Box>
        </CardContent>
      </Card>

      {!loading && securityFilter && insightCards.length > 0 && (
        <InsightCards cards={insightCards} />
      )}

      {!loading && securityFilter && chartRows.length > 0 && (
        <ChartPanel title={`Price trend — ${securityFilter}`}>
          <PriceHistoryChart data={chartRows} />
        </ChartPanel>
      )}

      {!loading && !securityFilter && rows.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Select a security above to view price chart and insights.
        </Alert>
      )}

      <Paper variant="outlined">
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {apiAvailable
                ? 'No price history yet. Upload a watchlist CSV above or from the Portfolio page.'
                : 'Connect to the portfolio API to load price history.'}
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 640 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={sortKey === 'tradingDate'}
                      direction={sortKey === 'tradingDate' ? sortDir : 'asc'}
                      onClick={() => handleSort('tradingDate')}
                    >
                      Date
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Security</TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortKey === 'lastPrice'}
                      direction={sortKey === 'lastPrice' ? sortDir : 'asc'}
                      onClick={() => handleSort('lastPrice')}
                    >
                      Last
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortKey === 'highPrice'}
                      direction={sortKey === 'highPrice' ? sortDir : 'asc'}
                      onClick={() => handleSort('highPrice')}
                    >
                      High
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortKey === 'lowPrice'}
                      direction={sortKey === 'lowPrice' ? sortDir : 'asc'}
                      onClick={() => handleSort('lowPrice')}
                    >
                      Low
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortKey === 'volume'}
                      direction={sortKey === 'volume' ? sortDir : 'asc'}
                      onClick={() => handleSort('volume')}
                    >
                      Volume
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortKey === 'changePercent'}
                      direction={sortKey === 'changePercent' ? sortDir : 'asc'}
                      onClick={() => handleSort('changePercent')}
                    >
                      % Chg
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Observed</TableCell>
                  <TableCell>Source file</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={`${row.security}-${row.tradingDate}`} hover>
                    <TableCell>{row.tradingDate}</TableCell>
                    <TableCell>{row.security}</TableCell>
                    <TableCell align="right">{formatNum(row.lastPrice)}</TableCell>
                    <TableCell align="right">{formatNum(row.highPrice)}</TableCell>
                    <TableCell align="right">{formatNum(row.lowPrice)}</TableCell>
                    <TableCell align="right">{formatNum(row.volume, 0)}</TableCell>
                    <TableCell align="right">{formatNum(row.changePercent)}</TableCell>
                    <TableCell>{formatObservedAt(row.observedAt)}</TableCell>
                    <TableCell>{row.sourceFile ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {!loading && rows.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Showing {rows.length} row{rows.length !== 1 ? 's' : ''}
          {securityFilter ? ` for ${securityFilter}` : ''}.
        </Typography>
      )}
    </Container>
  );
};

export default PriceHistoryPage;
