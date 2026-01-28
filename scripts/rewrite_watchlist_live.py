import csv
import re
from pathlib import Path

RAW = r"""
Security
Company Name
Bid Qty
Bid Price
Ask Price
Ask Qty
Last
Last Qty
Change
% Change
High
Low
VWA
Volume
Turnover
Trades
Price Close
Buy Sentiment
Time

CARS.N0000
PALM.N0000
LAMB.N0000
UCAR.N0000
REXP.N0000
WLTH.N0000
LGL.N0000
CINV.N0000
CDB.N0000
EBCR.N0000
HASU.N0000
DFCC.N0000
NTB.N0000
BOPL.N0000
SPEN.N0000
PARQ.N0000
MGT.N0000
JKH.N0000
RPBH.N0000
PKME.N0000
MELS.N0000
COCR.N0000
HARI.N0000
GUAR.N0000
DIAL.N0000
CCS.N0000
CDB.X0000
CIC.N0000
HELA.N0000
RICH.N0000
CBNK.N0000
CTC.N0000
TPL.N0000
CARG.N0000
TJL.N0000
HNB.N0000
COMB.N0000
OSEA.N0000
JAT.N0000
LPL.N0000
SAMP.N0000
KCAB.N0000
LALU.N0000
TKYO.X0000
TKYO.N0000
ACL.N0000
ASHO.N0000
LIOC.N0000
HNBF.N0000
LLUB.N0000
HNB.X0000
CFI.N0000
PLC.N0000
SMOT.N0000
DIPD.N0000
DOCK.N0000

CARSON CUMBERBATCH PLC	10	689.75	690.00	1,645	690.00	10	
-64.75
-8.58
749.00	689.75	698.20	12,651	8,832,947.50	291	754.75	
57.74%
13:07:02.214395
PALM GARDEN HOTELS PLC	55	71.40	74.70	9	71.00	303	
-4.90
-6.46
71.10	70.00	70.52	10,467	738,184.40	17	75.90	
7.39%
12:33:04.701027
KOTMALE HOLDINGS PLC	5	1,366.00	1,469.75	33	1,361.25	2	
-38.75
-2.77
1,471.00	1,361.25	1,403.63	56	78,603.50	5	1,400.00	
5.61%
12:34:53.719736
UNION CHEMICALS LANKA PLC	6	1,671.00	1,744.50	6	1,700.00	30	
-43.75
-2.51
1,749.50	1,640.25	1,681.69	599	1,007,334.25	23	1,743.75	
57.02%
13:02:30.449633
RICHARD PIERIS EXPORTS PLC	847	430.00	439.75	386	430.00	153	
-9.75
-2.22
454.00	425.00	437.64	3,187	1,394,762.75	68	439.75	
77.85%
13:25:51.357678
WEALTHTRUST SECURITIES LIMITED	28,238	15.50	15.60	59,500	15.60	100	
-0.30
-1.89
15.90	15.50	15.61	1,399,472	21,843,706.20	637	15.90	
7.43%
13:28:59.883954
LAUGFS GAS PLC	1,495	70.70	71.90	1,000	70.70	5	
-1.30
-1.81
73.00	70.00	71.55	168,851	12,080,759.60	83	72.00	
35.79%
13:21:30.130128
CEYLON INVESTMENT PLC	49	124.00	125.00	1,500	125.00	1,904	
-2.00
-1.57
125.50	123.00	124.53	65,153	8,113,553.50	133	127.00	
61.51%
13:24:19.001120
CITIZENS DEVELOPMENT BUSINESS FINANCE PLC	70	380.00	387.00	2,490	380.00	930	
-5.00
-1.30
387.00	380.00	380.29	975	370,783.75	8	385.00	
3.34%
13:15:40.679783
E B CREASY & COMPANY PLC	1,500	67.50	67.80	575	67.30	13,482	
-0.70
-1.03
68.00	67.30	67.41	408,144	27,513,278.00	36	68.00	
15.88%
13:15:42.008735
HNB ASSURANCE PLC	2,878	104.25	105.00	820	105.00	150	
-1.00
-0.94
108.00	103.00	104.11	5,765	600,222.75	24	106.00	
4.05%
13:26:39.281689
DFCC BANK PLC	560	157.75	158.00	5,379	158.00	3	
-1.25
-0.78
160.50	157.00	158.72	104,322	16,557,739.50	260	159.25	
62.17%
13:23:05.920826
NATIONS TRUST BANK PLC	944	345.50	346.00	2,448	345.50	4	
-2.50
-0.72
348.00	345.00	346.32	29,820	10,327,301.25	54	348.00	
49.27%
13:25:19.992458
BOGAWANTALAWA TEA ESTATES PLC	14	74.40	74.50	2,222	74.50	82	
-0.50
-0.67
74.70	74.50	74.51	1,168	87,026.20	18	75.00	
63.86%
13:21:28.357252
AITKEN SPENCE PLC	5,394	159.00	159.25	25	159.00	3,959	
-1.00
-0.62
160.00	151.25	157.51	14,329	2,256,956.25	39	160.00	
37.86%
13:29:02.133594
SWISSTEK (CEYLON) PLC	45	89.30	90.00	13,687	90.00	5	
-0.50
-0.55
91.00	89.00	90.36	94,459	8,534,857.50	97	90.50	
64.02%
13:25:37.790498
HAYLEYS FABRIC PLC	1,026	38.90	39.00	37,825	38.80	2,249	
-0.20
-0.51
39.00	38.50	38.76	76,457	2,963,388.90	114	39.00	
43.82%
13:12:09.492182
JOHN KEELLS HOLDINGS PLC	160,251	21.90	22.00	241,275	21.90	160	
-0.10
-0.45
22.10	21.80	21.91	4,553,514	99,777,009.70	542	22.00	
11.88%
13:29:17.867947
ROYAL PALMS BEACH HOTELS PLC	50	63.70	63.80	293	63.80	500	
-0.20
-0.31
63.90	63.80	63.80	515	32,858.50	2	64.00	
0%
10:34:36.077573
DIGITAL MOBILITY SOLUTIONS LANKA PLC	10,100	166.75	167.00	1,036	167.00	46	
-0.50
-0.30
168.00	165.00	166.65	73,657	12,274,658.25	138	167.50	
45.58%
13:26:21.474233
MELSTACORP PLC	720	179.25	180.00	15,997	180.00	1,000	
-0.50
-0.28
183.00	179.25	179.96	295,794	53,230,788.50	160	180.50	
72.31%
13:23:22.643840
COMMERCIAL CREDIT AND FINANCE PLC	1,395	132.25	133.00	25,253	132.25	328	
-0.25
-0.19
133.00	131.50	132.47	28,872	3,824,634.25	63	132.50	
66.04%
13:28:14.529264
HARISCHANDRA MILLS PLC	5	5,550.00	5,575.00	4	5,575.00	1	
-10.75
-0.19
5,575.00	5,502.00	5,526.37	49	270,792.00	13	5,585.75	
53.26%
13:10:13.610227
CEYLON GUARDIAN INVESTMENT TRUST PLC	5	268.00	272.50	1,100	270.00	195	
-0.50
-0.18
273.00	260.00	262.89	6,401	1,682,778.50	9	270.50	
8.08%
13:29:18.344277
DIALOG AXIATA PLC	32,944	33.90	34.10	78,451	33.90	789	
0.00
0.00
34.20	33.80	34.00	3,748,616	127,464,033.30	493	33.90	
13.78%
13:25:32.042114
CEYLON COLD STORES PLC	1,811	114.00	114.25	305	114.00	3	
0.00
0.00
114.50	112.50	113.78	22,758	2,589,421.50	70	114.00	
70.75%
13:28:11.046084
CITIZENS DEVELOPMENT BUSINESS FINANCE PLC [Non-Voting]	150	296.50	300.00	352	300.00	200	
0.00
0.00
300.00	297.50	298.04	37,367	11,136,795.50	26	300.00	
2.28%
13:20:16.630729
C I C HOLDINGS PLC	91,299	37.80	38.00	98,425	38.00	75	
0.00
0.00
38.20	37.80	37.97	577,533	21,929,893.50	236	38.00	
42.11%
13:26:54.547334
HELA APPAREL HOLDINGS PLC	880,798	3.30	3.40	435,974	3.40	6	
0.00
0.00
3.50	3.30	3.38	514,195	1,737,795.00	76	3.40	
70.02%
13:12:37.849614
RICHARD PIERIS AND COMPANY PLC	6	39.50	40.00	5,035	40.00	10	
0.00
0.00
40.20	38.90	39.06	45,211	1,765,891.90	61	40.00	
2.85%
13:18:44.075303
CARGILLS BANK PLC	235,927	9.60	9.70	151,966	9.60	29	
0.00
0.00
9.80	9.50	9.62	792,334	7,622,334.30	191	9.60	
57.31%
13:15:47.191087
CEYLON TOBACCO COMPANY PLC	12	1,748.00	1,750.00	84	1,750.00	2	
0.00
0.00
1,765.00	1,745.00	1,759.95	1,501	2,641,687.00	53	1,750.00	
59.54%
13:21:49.366059
TALAWAKELLE TEA ESTATES PLC	1	145.50	146.00	12	146.00	200	
0.00
0.00
146.00	145.00	145.24	4,853	704,857.75	19	146.00	
28.28%
13:28:09.438066
CARGILLS (CEYLON) PLC	1	772.00	772.50	11,096	772.00	4	
1.00
0.13
772.50	772.00	772.49	337	260,330.50	10	771.00	
98.81%
12:54:09.867405
TEEJAY LANKA PLC	11,495	34.80	35.00	24,112	35.00	100	
0.10
0.29
35.00	34.60	34.83	132,184	4,604,375.10	188	34.90	
39.24%
13:28:36.344702
HATTON NATIONAL BANK PLC	129	421.75	422.00	10,484	421.75	272	
1.25
0.30
423.00	419.50	421.89	104,749	44,192,973.50	186	420.50	
96.08%
13:27:10.673937
COMMERCIAL BANK OF CEYLON PLC	7,120	224.50	225.00	12,143	225.00	1,500	
0.75
0.33
225.00	224.00	224.82	202,023	45,419,515.75	213	224.25	
79.84%
13:29:08.884593
OVERSEAS REALTY (CEYLON) PLC	11,655	46.80	46.90	5,431	46.80	45	
0.20
0.43
47.00	46.50	46.71	229,366	10,714,514.40	84	46.60	
57.05%
13:28:48.000441
JAT HOLDINGS PLC	29,253	47.00	48.30	2,000	47.00	2	
0.30
0.64
48.60	46.60	47.30	216,104	10,222,016.50	107	46.70	
63.57%
13:27:27.411654
LAUGFS POWER PLC	16,171	13.70	14.10	1,691	13.70	18	
0.10
0.74
14.10	13.70	13.74	29,125	400,144.70	20	13.60	
15.63%
13:22:30.239772
SAMPATH BANK PLC	5,900	156.75	157.00	53,199	156.75	2,000	
1.50
0.97
157.25	155.00	156.43	580,575	90,819,535.50	473	155.25	
79.52%
13:28:51.478068
KELANI CABLES PLC	914	146.00	149.00	3,794	149.00	3,140	
1.50
1.02
149.50	145.00	147.42	49,637	7,317,446.25	134	147.50	
56.06%
13:28:05.620217
LANKA ALUMINIUM INDUSTRIES PLC	1,941	48.70	49.50	7,823	49.50	20	
0.50
1.02
49.70	48.60	48.84	31,846	1,555,201.50	30	49.00	
55.25%
13:28:03.676221
TOKYO CEMENT COMPANY (LANKA) PLC [Non-Voting]	6	96.20	96.40	2,545	96.40	2,455	
1.30
1.37
98.00	95.50	97.02	761,043	73,834,903.80	215	95.10	
46.15%
13:28:40.093587
TOKYO CEMENT COMPANY (LANKA) PLC	12,891	115.50	116.00	121,896	116.00	500	
1.75
1.53
117.50	114.50	115.99	352,390	40,874,717.25	251	114.25	
87.72%
13:28:11.504459
ACL CABLES PLC	2,605	106.75	107.00	137,076	107.00	9	
1.75
1.66
107.00	105.50	106.50	1,534,726	163,441,516.50	725	105.25	
74.16%
13:29:03.301165
LANKA ASHOK LEYLAND PLC	1	3,960.25	3,998.75	10	3,998.75	10	
68.75
1.75
4,099.00	3,950.25	4,039.70	161	650,391.25	23	3,930.00	
79.95%
13:27:08.080605
LANKA IOC PLC	2,400	139.00	139.75	100	139.00	500	
2.50
1.83
140.00	136.50	138.49	206,103	28,543,419.50	170	136.50	
74.30%
13:24:15.584559
HNB FINANCE PLC	100,475	8.30	8.40	136,751	8.30	625	
0.20
2.47
8.50	8.20	8.36	982,343	8,210,801.70	82	8.10	
94.19%
13:16:24.731640
CHEVRON LUBRICANTS LANKA PLC	50	194.50	195.00	1,169	195.00	2	
4.75
2.50
197.00	190.00	192.64	505,941	97,462,731.25	202	190.25	
93.40%
13:25:58.218950
HATTON NATIONAL BANK PLC [Non-Voting]	1,211	366.50	367.00	2,347	366.50	1,000	
9.00
2.52
369.00	357.50	364.51	230,072	83,864,601.50	230	357.50	
78.55%
13:25:57.217221
COLOMBO FORT INVESTMENTS PLC	100	439.00	449.75	250	450.00	10	
12.00
2.74
450.00	437.00	443.62	155	68,760.50	7	438.00	
91.10%
11:50:52.009013
PEOPLE S LEASING & FINANCE PLC	5,510	26.10	26.20	1,663	26.10	634	
0.90
3.57
26.40	25.00	25.98	1,411,022	36,652,451.60	108	25.20	
87.72%
13:26:02.625353
SATHOSA MOTORS PLC	1	1,661.00	1,724.00	4	1,730.00	1	
79.75
4.83
1,730.00	1,730.00	1,730.00	1	1,730.00	1	1,650.25	
100%
13:01:54.299240
DIPPED PRODUCTS PLC	1,100	65.00	65.50	33,101	65.50	10,000	
3.70
5.99
65.60	62.00	64.18	910,086	58,413,108.90	244	61.80	
77.07%
13:29:20.684452
COLOMBO DOCKYARD PLC	7,504	139.50	140.00	4,990	140.00	10	
26.25
23.08
162.00	118.00	134.58	17,045,030	2,293,934,406.25	9999	113.75	
60.69%
13:29:27.538
"""


SECURITY_RE = re.compile(r"^[A-Z0-9]+\.(?:N|X)\d{4}$")


def _clean_num(s: str) -> str:
    # Keep '-' and '.' but remove thousand separators and stray whitespace.
    return s.strip().replace(",", "")


def _split_fields(line: str) -> list[str]:
    line = line.strip()
    if "\t" in line:
        parts = [p.strip() for p in line.split("\t") if p.strip() != ""]
        return parts
    # Fallback: split on 2+ spaces (keeps company names with single spaces intact)
    parts = [p.strip() for p in re.split(r"\s{2,}", line) if p.strip() != ""]
    return parts


def main() -> None:
    lines = [ln.rstrip("\n") for ln in RAW.splitlines()]
    nonempty = [ln.strip() for ln in lines if ln.strip() != ""]

    securities: list[str] = []
    for ln in nonempty:
        if SECURITY_RE.match(ln):
            securities.append(ln)

    blocks: list[dict[str, str]] = []

    # Find blocks by scanning for a "line1" that has multiple fields and isn't a security
    i = 0
    while i < len(nonempty):
        ln = nonempty[i]
        if SECURITY_RE.match(ln):
            i += 1
            continue

        fields = _split_fields(ln)
        # line1 has: Company, BidQty, BidPrice, AskPrice, AskQty, Last, LastQty
        if len(fields) >= 7 and not SECURITY_RE.match(fields[0]) and not fields[0].lower().startswith("security"):
            company = fields[0]
            bid_qty, bid_price, ask_price, ask_qty, last, last_qty = fields[1:7]

            # Next lines: Change, %Change, then line4 (High..PriceClose), then BuySentiment, then Time
            if i + 5 >= len(nonempty):
                raise SystemExit(f"Incomplete block near: {company}")

            change = nonempty[i + 1]
            pct_change = nonempty[i + 2]
            line4_fields = _split_fields(nonempty[i + 3])
            if len(line4_fields) < 7:
                raise SystemExit(f"Bad line4 block near: {company}: {nonempty[i+3]!r}")
            high, low, vwa, volume, turnover, trades, price_close = line4_fields[:7]
            buy_sentiment = nonempty[i + 4]
            time = nonempty[i + 5]

            blocks.append(
                {
                    "Company Name": company,
                    "Bid Qty": _clean_num(bid_qty),
                    "Bid Price": _clean_num(bid_price),
                    "Ask Price": _clean_num(ask_price),
                    "Ask Qty": _clean_num(ask_qty),
                    "Last": _clean_num(last),
                    "Last Qty": _clean_num(last_qty),
                    "Change": _clean_num(change),
                    "% Change": _clean_num(pct_change),
                    "High": _clean_num(high),
                    "Low": _clean_num(low),
                    "VWA": _clean_num(vwa),
                    "Volume": _clean_num(volume),
                    "Turnover": _clean_num(turnover),
                    "Trades": _clean_num(trades),
                    "Price Close": _clean_num(price_close),
                    "Buy Sentiment": buy_sentiment.strip(),
                    "Time": time.strip(),
                }
            )
            i += 6
            continue

        i += 1

    if len(securities) != len(blocks):
        raise SystemExit(f"Security count ({len(securities)}) != data block count ({len(blocks)})")

    out_path = Path("Watchlist_Live") / "Watchlist_live.csv"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    header = [
        "Security",
        "Company Name",
        "Bid Qty",
        "Bid Price",
        "Ask Price",
        "Ask Qty",
        "Last",
        "Last Qty",
        "Change",
        "% Change",
        "High",
        "Low",
        "VWA",
        "Volume",
        "Turnover",
        "Trades",
        "Price Close",
        "Buy Sentiment",
        "Time",
    ]

    with out_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        for sec, block in zip(securities, blocks):
            w.writerow(
                [
                    sec,
                    block["Company Name"],
                    block["Bid Qty"],
                    block["Bid Price"],
                    block["Ask Price"],
                    block["Ask Qty"],
                    block["Last"],
                    block["Last Qty"],
                    block["Change"],
                    block["% Change"],
                    block["High"],
                    block["Low"],
                    block["VWA"],
                    block["Volume"],
                    block["Turnover"],
                    block["Trades"],
                    block["Price Close"],
                    block["Buy Sentiment"],
                    block["Time"],
                ]
            )


if __name__ == "__main__":
    main()

