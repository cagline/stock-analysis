# Portfolio Analysis Feature

## Overview
This feature provides lot-wise gain/loss analysis for stock portfolios imported from ATrad broker platform (CAL Sri Lanka).

## Features

### 1. CSV Import
- Upload Order Tracker CSV files exported from ATrad
- Automatically parses and validates order data
- Filters only FILLED orders (Remaining Qty = 0)
- Handles multiple orders with same Exchange Order Id

### 2. Lot Tracking
- Each BUY order creates a separate lot
- SELL orders are matched to BUY lots using FIFO (First In First Out) method
- Tracks remaining quantity per lot
- Calculates realized gain/loss for each sell transaction

### 3. Portfolio Analysis
- **Holdings Overview**: Shows current holdings with average buy price, total cost, and unrealized gain/loss
- **Lot-wise Analysis**: Detailed view of each lot with:
  - Buy date and price
  - Quantity and remaining quantity
  - Sell transaction details
  - Realized gain/loss per sell
  - Unrealized gain/loss for remaining holdings

### 4. Current Price Management
- Manually set current prices for securities
- Automatically calculates unrealized gain/loss when prices are set
- Market value calculation based on current prices

## Data Processing Logic

### Order Processing
1. CSV is parsed and validated
2. Only FILLED orders with Remaining Qty = 0 are processed
3. For orders with same Exchange Order Id, only the complete fill is processed
4. Orders are sorted chronologically

### Lot Matching (FIFO)
- BUY orders create new lots
- SELL orders are matched to oldest available lots first
- Partial sells are supported (lot quantity is reduced)
- Multiple sells can be matched to the same lot

### Gain/Loss Calculation
- **Realized G/L**: Calculated when SELL orders are matched to BUY lots
  - Formula: `(Sell Price - Buy Price) × Quantity`
- **Unrealized G/L**: Calculated for remaining holdings
  - Formula: `(Current Price - Buy Price) × Remaining Quantity`

## Stock Splits

**Note**: Stock splits are not automatically handled in the current version. If a security has undergone a stock split:

1. The quantity and prices in the CSV may reflect post-split values
2. Historical orders before the split may need manual adjustment
3. Consider adding a stock split adjustment feature in future versions

**Workaround**: 
- If your CSV data already reflects post-split values, the analysis will work correctly
- For historical accuracy, you may need to manually adjust pre-split orders

## Usage

1. Navigate to `/portfolio` route
2. Click "Upload Order Tracker CSV"
3. Select your exported CSV file from ATrad
4. View holdings overview and lot-wise analysis
5. Optionally set current prices to see unrealized gain/loss

## CSV Format Requirements

The CSV should have the following columns (from ATrad Order Tracker export):
- Security
- Side (BUY/SELL)
- Order Qty
- Order Price
- Order Value
- Order Status
- Remaining Qty
- Filled Qty
- Order Date and Time
- Exchange Order Id

## Technical Details

### State Management
- Uses Redux Toolkit for state management
- Portfolio slice manages orders, lots, holdings, and current prices

### Components
- `Portfolio.tsx`: Main component with CSV upload and analysis views
- `LotWiseAnalysis`: Sub-component for detailed lot breakdown

### Utilities
- `csvParser.ts`: Parses ATrad CSV format
- `lotTracker.ts`: Processes orders into lots and calculates holdings
- `aiMetadataExport.ts`: Exports portfolio data for AI analysis
- `exportUtils.ts`: General export utilities
- `recommendationEngine.ts`: Generates action recommendations

---

## AI Analysis Workflow

The portfolio feature supports exporting data in formats optimized for AI analysis (ChatGPT, Claude, etc.).

### Export Formats

| Format | File Pattern | Best For |
|--------|--------------|----------|
| **JSON Metadata** | `portfolio-ai-metadata-YYYY-MM-DD.json` | Exact numbers, lot-level detail, programmatic analysis |
| **Markdown Analysis** | `portfolio-ai-analysis-YYYY-MM-DD.md` | Narrative analysis, written suggestions, easy to read |
| **Action Ranges JSON** | `portfolio-action-ranges-request-YYYY-MM-DD.json` | Price zone generation, CSV output, action-oriented suggestions |

### Recommended Workflow

1. **Export portfolio data** using one of the formats above
2. **Upload to AI agent** (ChatGPT, Claude, etc.)
3. **Request analysis** — the Markdown format includes a built-in "Analysis Request" section
4. **Review suggestions** and apply to your trading decisions

### Format Selection Guide

- **For "give me suggestions"**: Use the **Markdown** format — most convenient for narrative analysis
- **For exact calculations**: Use the **JSON Metadata** — precise lot-level and sell history
- **For price zones/CSV**: Use the **Action Ranges JSON** — includes suggested zones and CSV generation instructions

---

## Position Categories

Based on AI analysis, positions can be categorized for portfolio management:

### Core Holdings (Hold/Trim)
Securities with good unrealized gains or strong fundamentals. Actions:
- **Hold**: Keep position, set mental trailing stop
- **Trim**: Take partial profit on strength (use Trim zone from action ranges)

### Monitor Positions
Small positions (1–2 shares) kept intentionally to track price and news for future opportunities. Examples:
- Sector plays (e.g., coconut industry exposure)
- Banks or blue chips you want to watch

**Rule**: Keep in portfolio for visibility; add only when clear opportunity appears.

### Exit Candidates
Positions to consider exiting based on:
- **Losses**: Unrealized loss with weak thesis
- **Tiny size**: Too small to matter (unless intentional monitor position)
- **Risk flags**: Financial position concerns, price stability issues
- **Analyst downgrades**: Weakened outlook

**Exit priority order**:
1. Risk flags or deteriorating fundamentals
2. Losses with no recovery thesis
3. Simplification (too many small positions)

---

## Action Price Ranges

The system can generate or AI can suggest action price ranges for each security:

| Zone | Description | Typical Calculation |
|------|-------------|---------------------|
| **Strong Add Zone** | Best prices for aggressive buying | 10–20% below current (if in profit) or 5–10% below avg (if in loss) |
| **Accumulate Slowly** | Good entry zone for gradual adding | 5–10% below current price |
| **Pause Buys** | Too extended, wait for pullback | 10–15% above current price |
| **Trim Small Portion** | Take partial profits | 20–30% above current price |
| **Trailing Stop** | Exit if price breaks below | 5–10% below current (profit) or break-even (loss) |
| **Re-evaluate if Weak** | Critical support level | 15–25% below current price |

### Using Action Ranges

1. Export the action ranges JSON or generate CSV
2. Set alerts at key levels (Strong Add, Trailing Stop)
3. Follow the zones: add in "Strong Add", pause in "Pause Buys", trim in "Trim" zone
4. Update monthly or after significant price moves

---

## News and Context Integration

When analyzing portfolio with AI, you can enhance suggestions by providing:
- Recent news about specific securities
- Sector trends (e.g., "coconut exports growing 42% YoY")
- Earnings reports or analyst updates
- Your investment thesis for positions

Example: "Keep COCO.N and COCO.X as monitor positions — coconut sector is booming with IFC/Australia export partnership"

---

## Best Practices

1. **Monitor closely**: For most positions, "monitor and see how it goes" is sufficient
2. **Set mental stops**: Use trailing stop levels from action ranges
3. **Don't chase**: Add only in "Strong Add" or "Accumulate" zones
4. **Cut risk flags**: Exit positions with explicit financial/stability concerns
5. **Keep monitor positions**: 1–2 shares for tracking are valid (not clutter)
6. **Review periodically**: Re-run AI analysis monthly or after major moves
