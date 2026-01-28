import csv
from pathlib import Path


ACTION_PATH = Path("Portfolio_Action_Price_Ranges/Portfolio_Action_Price_Ranges.csv")
PORTFOLIO_PATH = Path("Portfolio/Portfolio.csv")
WATCHLIST_PATH = Path("Watchlist_Live/Watchlist_live.csv")


HEADER = [
    "Company Code",
    "Quantity",
    "Avg Price",
    "B.E.S Price",
    "Last",
    "Change",
    "% Change",
    "Accumulate Slowly",
    "Strong Add Zone",
    "Re-evaluate if Market Weak",
    "Pause Buys",
    "Trim Small Portion",
    "Investment_Percentage",
    "Time",
    "Trailing Stop (SELL if below)",
]


PRESERVE_COLS = [
    "Accumulate Slowly",
    "Strong Add Zone",
    "Re-evaluate if Market Weak",
    "Pause Buys",
    "Trim Small Portion",
    "Investment_Percentage",
    "Trailing Stop (SELL if below)",
]


def _strip_commas(s: str) -> str:
    return (s or "").strip().replace(",", "")


def _read_existing_action_map() -> dict[str, dict[str, str]]:
    if not ACTION_PATH.exists():
        return {}

    with ACTION_PATH.open("r", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    out: dict[str, dict[str, str]] = {}
    for r in rows:
        code = (r.get("Company Code") or "").strip()
        if not code:
            continue
        out[code] = r
    return out


def _read_watchlist_map() -> dict[str, dict[str, str]]:
    if not WATCHLIST_PATH.exists():
        return {}

    with WATCHLIST_PATH.open("r", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    out: dict[str, dict[str, str]] = {}
    for r in rows:
        code = (r.get("Security") or "").strip()
        if not code:
            continue
        out[code] = r
    return out


def _read_portfolio_holdings() -> list[dict[str, str]]:
    """
    Returns portfolio holdings as dicts with at least:
      - Security, Quantity, Avg Price, B.E.S Price, Holding % (Market Value)
    """
    with PORTFOLIO_PATH.open("r", encoding="utf-8", newline="") as f:
        all_rows = list(csv.reader(f))

    header_idx = None
    for i, row in enumerate(all_rows):
        if row and row[0].strip() == "Security":
            header_idx = i
            break

    if header_idx is None:
        raise SystemExit("Could not find portfolio header row starting with 'Security'")

    headers = [h.strip() for h in all_rows[header_idx]]
    out: list[dict[str, str]] = []

    for row in all_rows[header_idx + 1 :]:
        if not row or not row[0].strip():
            continue
        if row[0].strip().lower() == "total":
            break
        r = {headers[j]: row[j] if j < len(row) else "" for j in range(len(headers))}
        out.append(r)

    return out


def main() -> None:
    existing = _read_existing_action_map()
    watch = _read_watchlist_map()
    holdings = _read_portfolio_holdings()

    ACTION_PATH.parent.mkdir(parents=True, exist_ok=True)

    with ACTION_PATH.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=HEADER)
        w.writeheader()

        for h in holdings:
            code = (h.get("Security") or "").strip()
            if not code:
                continue

            qty = _strip_commas(h.get("Quantity", ""))
            avg_price = _strip_commas(h.get("Avg Price", ""))
            bes_price = _strip_commas(h.get("B.E.S Price", ""))
            holding_pct_mv = _strip_commas(h.get("Holding % (Market Value)", ""))

            prev = existing.get(code, {})
            live = watch.get(code, {})

            # Prefer watchlist for live fields; otherwise keep prior if it existed.
            last = _strip_commas(live.get("Last") or prev.get("Last", ""))
            change = _strip_commas(live.get("Change") or prev.get("Change", ""))
            pct_change = _strip_commas(live.get("% Change") or prev.get("% Change", ""))
            time = (live.get("Time") or prev.get("Time", "") or "").strip()

            row: dict[str, str] = {
                "Company Code": code,
                "Quantity": qty,
                "Avg Price": avg_price,
                "B.E.S Price": bes_price,
                "Last": last,
                "Change": change,
                "% Change": pct_change,
                "Time": time,
            }

            for col in PRESERVE_COLS:
                if col == "Investment_Percentage":
                    inv = (prev.get(col) or "").strip()
                    if not inv and holding_pct_mv:
                        inv = f"{holding_pct_mv}%"
                    row[col] = inv
                else:
                    row[col] = (prev.get(col) or "").strip()

            w.writerow(row)


if __name__ == "__main__":
    main()

