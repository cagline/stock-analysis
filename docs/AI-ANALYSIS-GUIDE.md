# AI Portfolio Analysis Guide

How to use AI agents (ChatGPT, Claude, etc.) to analyze your stock portfolio and get actionable suggestions.

---

## Quick Start

1. **Export** your portfolio data from the app (use the AI export buttons)
2. **Upload** to your preferred AI agent
3. **Ask** for analysis and suggestions
4. **Apply** the recommendations to your trading decisions

---

## Export Formats

The portfolio feature provides three export formats optimized for AI analysis:

### 1. JSON Metadata (`portfolio-ai-metadata-*.json`)

**Best for:** Exact numbers, lot-level detail, programmatic analysis.

**Contains:**
- Portfolio summary (total value, cost, unrealized G/L)
- Per-security current position (quantity, avg price, current price, gain/loss)
- Lot details with full transaction history (buy dates, sell orders, realized G/L)
- Action price ranges (if set)
- Recommendations (if set)

**Use when:** You need precise figures or want the AI to calculate specific metrics.

### 2. Markdown Analysis (`portfolio-ai-analysis-*.md`)

**Best for:** Narrative analysis, written suggestions, easy to read.

**Contains:**
- Formatted portfolio summary
- Securities grouped by recommendation type
- Transaction history tables per lot
- Built-in "Analysis Request" section asking for:
  1. Overall assessment
  2. Action recommendations
  3. Risk management
  4. Optimization suggestions
  5. Market context

**Use when:** You want the AI to "give me suggestions" — this is the most convenient format.

### 3. Action Ranges JSON (`portfolio-action-ranges-request-*.json`)

**Best for:** Price zone generation, CSV output, action-oriented suggestions.

**Contains:**
- Portfolio data with pre-calculated suggested zones
- Instructions for generating action ranges CSV
- Example CSV row format
- Calculation guidelines for each zone type

**Use when:** You want the AI to generate a CSV with buy/sell zones, or when tying suggestions to specific price levels.

---

## Format Comparison

| Need | Best Format |
|------|-------------|
| "Give me suggestions" | Markdown |
| Exact lot-level calculations | JSON Metadata |
| Generate action ranges CSV | Action Ranges JSON |
| Quick portfolio health check | Markdown |
| Deep-dive on specific security | JSON Metadata |

**Practical combo:** Use the Markdown file as the main brief for "analyze and suggest," and reference the JSON Metadata when you need precise numbers or lot-level detail.

---

## Sample AI Prompts

### General Analysis
```
Please analyze this portfolio and provide:
1. Overall health assessment
2. Risk and concentration issues
3. Specific action recommendations for each holding
4. Priority order for any exits or trims
```

### Exit Candidates
```
If I wanted to exit some positions, which companies should I consider? 
Prioritize by: losses, risk flags, tiny size, or weak outlook.
```

### News-Enhanced Analysis
```
Based on the portfolio data above and this recent news:
[paste news here]
Should I adjust my position in [security]?
```

### Price Zone Suggestions
```
For each security in profit, suggest:
1. Where to add more (Strong Add zone)
2. Where to pause buying (Pause zone)
3. Where to take partial profit (Trim zone)
4. Where to set a trailing stop
```

---

## Position Categories

AI analysis typically categorizes positions into:

### Core Holdings (Hold/Trim)
- Good unrealized gains or strong fundamentals
- Actions: Hold with trailing stop, or trim on strength

### Monitor Positions
- Small positions (1–2 shares) kept to track price and news
- Purpose: Notice opportunities early
- Rule: Keep for visibility; add only on clear opportunity

### Exit Candidates
Prioritized by:
1. **Risk flags** — financial concerns, analyst warnings
2. **Losses** — unrealized loss with no recovery thesis
3. **Simplification** — too many small, low-conviction positions

---

## Action Price Ranges Reference

| Zone | Purpose | Typical Calculation |
|------|---------|---------------------|
| **Strong Add Zone** | Best prices for aggressive buying | 10–20% below current (profit) or 5–10% below avg (loss) |
| **Accumulate Slowly** | Good entry for gradual adding | 5–10% below current |
| **Pause Buys** | Too extended, wait for pullback | 10–15% above current |
| **Trim Small Portion** | Take partial profits | 20–30% above current |
| **Trailing Stop** | Exit if price breaks below | 5–10% below current (profit) or break-even (loss) |
| **Re-evaluate if Weak** | Critical support level | 15–25% below current |

---

## Enhancing AI Analysis

Provide additional context for better suggestions:

### Recent News
```
Today's news: "Sri Lanka partners with IFC & Australia to boost coconut exports"
How does this affect COCO.N and COCO.X?
```

### Your Thesis
```
I'm holding JETS as a tourism recovery play. 
Given the sector volatility, should I keep or exit?
```

### Sector Trends
```
Coconut exports grew 42% YoY ($1,233 Mn total earnings).
Which coconut-related positions should I hold/add?
```

### Risk Tolerance
```
I want to reduce risk and simplify the portfolio.
Which positions should I exit first?
```

---

## Best Practices

1. **Export regularly** — Re-export before major decisions or monthly reviews
2. **Combine formats** — Use Markdown for narrative, JSON for precise figures
3. **Add context** — Include news, your thesis, and risk tolerance
4. **Verify suggestions** — AI suggestions are starting points, not final decisions
5. **Update action ranges** — Re-generate after significant price moves
6. **Keep monitor positions** — 1–2 shares for tracking are valid, not clutter

---

## Workflow Summary

```
┌─────────────────┐
│  Export Data    │  (JSON, Markdown, or Action Ranges)
└────────┬────────┘
         ▼
┌─────────────────┐
│  Upload to AI   │  (ChatGPT, Claude, etc.)
└────────┬────────┘
         ▼
┌─────────────────┐
│  Ask Questions  │  (analysis, exits, zones, news impact)
└────────┬────────┘
         ▼
┌─────────────────┐
│  Review Output  │  (categorize positions, prioritize actions)
└────────┬────────┘
         ▼
┌─────────────────┐
│  Apply Actions  │  (hold, monitor, trim, exit)
└────────┴────────┘
```

---

## Related Documentation

- [Portfolio Feature README](../src/features/portfolio/README.md) — Feature overview, CSV import, lot tracking
- [FEATURE-STRUCTURE.md](./FEATURE-STRUCTURE.md) — How features are organized
