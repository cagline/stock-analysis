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
  Paper,
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
} from '@mui/material';
import { CloudUpload as CloudUploadIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { ChartPanel, InsightCards } from '../../shared/InsightCards';
import { PortfolioHistoryChart } from '../../shared/PortfolioHistoryChart';
import { usePortfolioHistoryController } from './usePortfolioHistoryController';

const PortfolioHistoryPage: React.FC = () => {
  const {
    rows,
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
    setSnapshotDate,
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
  } = usePortfolioHistoryController();

  return (
    <Container maxWidth={false} sx={{ py: 4, px: { xs: 2, sm: 3, md: 4 }, maxWidth: '1920px', width: '100%' }}>
      <Typography variant="h5" gutterBottom>
        Portfolio History
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Daily portfolio snapshots — holdings, market value, and unrealized gain/loss over time.
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
            Upload Portfolio
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end' }}>
            <TextField
              label="Snapshot date"
              type="date"
              size="small"
              value={snapshotDate}
              onChange={(e) => setSnapshotDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="Defaults to the file's saved date on upload. Edit before uploading to override."
              sx={{ minWidth: 280 }}
            />
            <Box
              component="input"
              accept=".csv,.xlsx,.xls"
              sx={{ display: 'none' }}
              id="portfolio-history-upload-input"
              type="file"
              onChange={handlePortfolioUpload}
              disabled={uploading || !apiAvailable}
            />
            <label htmlFor="portfolio-history-upload-input">
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
                  'Upload Portfolio CSV / Excel'
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
              <InputLabel id="portfolio-security-filter">Security</InputLabel>
              <Select
                labelId="portfolio-security-filter"
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

      {!loading && insightCards.length > 0 && <InsightCards cards={insightCards} />}

      {!loading && securityFilter && securityChartData.length > 0 && (
        <ChartPanel title={`Position value — ${securityFilter}`}>
          <PortfolioHistoryChart data={securityChartData} />
        </ChartPanel>
      )}

      {!loading && !securityFilter && aggregateChartData.length > 0 && (
        <ChartPanel title="Total portfolio value over time">
          <PortfolioHistoryChart data={aggregateChartData} />
        </ChartPanel>
      )}

      <Paper variant="outlined">
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : rows.length === 0 && aggregateChartData.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {apiAvailable
                ? 'No portfolio history yet. Upload a Portfolio CSV or Excel file above or from the Portfolio page.'
                : 'Connect to the portfolio API to load portfolio history.'}
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 640 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={sortKey === 'snapshotDate'}
                      direction={sortKey === 'snapshotDate' ? sortDir : 'asc'}
                      onClick={() => handleSort('snapshotDate')}
                    >
                      Date
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Security</TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortKey === 'quantity'}
                      direction={sortKey === 'quantity' ? sortDir : 'asc'}
                      onClick={() => handleSort('quantity')}
                    >
                      Qty
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortKey === 'tradedPrice'}
                      direction={sortKey === 'tradedPrice' ? sortDir : 'asc'}
                      onClick={() => handleSort('tradedPrice')}
                    >
                      Traded
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortKey === 'marketValue'}
                      direction={sortKey === 'marketValue' ? sortDir : 'asc'}
                      onClick={() => handleSort('marketValue')}
                    >
                      Market Value
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">Unrealized G/L</TableCell>
                  <TableCell align="right">Unr G/L %</TableCell>
                  <TableCell>Source file</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={`${row.security}-${row.snapshotDate}`} hover>
                    <TableCell>{row.snapshotDate}</TableCell>
                    <TableCell>{row.security}</TableCell>
                    <TableCell align="right">{formatNum(row.quantity, 0)}</TableCell>
                    <TableCell align="right">{formatNum(row.tradedPrice)}</TableCell>
                    <TableCell align="right">{formatNum(row.marketValue)}</TableCell>
                    <TableCell align="right">{formatNum(row.unrealizedGainLoss)}</TableCell>
                    <TableCell align="right">{formatNum(row.unrealizedGainLossPct)}</TableCell>
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

export default PortfolioHistoryPage;
