#!/usr/bin/env python3
"""Generate the Tamil Nadu public snapshot from the active survey workbook,
ECI/TCPD historical assembly results and the post-2008 AC shapefile.
Run from the repository root. Inputs are documented in the output metadata.
"""
import csv, json, math, os, re, sys, hashlib
from collections import Counter, defaultdict
from datetime import datetime, timezone
import openpyxl, shapefile
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
from shapely.validation import make_valid

ROOT = os.getcwd()
SURVEY = os.environ.get("TN_SURVEY_XLSX", ".context/attachments/T2l4JS/TN2026_Poll_Upload_Estimated_Districts.xlsx")
TCPD = os.environ.get("TN_TCPD_CSV", "/private/var/folders/qv/k8n71fys7gzgvbhgm7vr3z9h0000gn/T/opencode/tn-data/tcpd.csv")
ECI2021 = os.environ.get("TN_2021_CSV", "/private/var/folders/qv/k8n71fys7gzgvbhgm7vr3z9h0000gn/T/opencode/tn-data/2021.csv")
SHP = os.environ.get("TN_AC_SHP", "/private/var/folders/qv/k8n71fys7gzgvbhgm7vr3z9h0000gn/T/opencode/tn-data/shp/S22_AC.shp")
OUT = "lib/data/tamil-nadu"

GROUPS = ["TVK", "DMK+INC+VCK", "AIADMK+BJP+PMK+AMMK", "NTK", "NOTA", "Others"]
LABELS = {g: g for g in GROUPS}
COLORS = {
    "TVK": "#EAB308",
    "DMK+INC+VCK": "#DC2626",
    "AIADMK+BJP+PMK+AMMK": "#16A34A",
    "NTK": "#7C3AED",
    "NOTA": "#94A3B8",
    "Others": "#64748B",
}
YEARS = ["2011", "2016", "2021"]
DISTRICT_ALIASES = {
    "Kanniyakumari": "Kanyakumari",
    "The Nilgiris": "Nilgiris",
    "Thoothukudi": "Thoothukkudi",
    "Tirupattur": "Tirupathur",
}
def canon_district(v):
    s = str(v or "").strip()
    return DISTRICT_ALIASES.get(s, s)
def canon_ac(v):
    s = str(v or "").strip().lower()
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"[^a-z0-9]", "", s)
    return s
def num(v):
    try: return float(str(v).replace(",", "").strip())
    except Exception: return 0.0
def r6(v): return round(float(v), 6)
def shares_from_counts(counts, denom):
    if not denom: return None
    return {g: r6(counts.get(g, 0) / denom) for g in GROUPS}
def historical_shares(counts, denom):
    """Historical groups must total 100%; Others is the residual after the named groups."""
    if not denom: return None
    named = sum(counts.get(g, 0) for g in GROUPS if g != "Others")
    out = {g: r6(counts.get(g, 0) / denom) for g in GROUPS if g != "Others"}
    out["Others"] = r6(max(0.0, 1.0 - named / denom))
    return {g: out[g] for g in GROUPS}
def group_of(party, year):
    p = str(party or "").strip()
    u = p.upper()
    if year == 2021:
        if u in ("DMK", "INC", "VCK"): return "DMK+INC+VCK"
        if u in ("AIADMK", "BJP", "PMK", "AMMK"): return "AIADMK+BJP+PMK+AMMK"
        if u == "TVK": return "TVK"
        if u == "NTK": return "NTK"
        if u == "NOTA": return "NOTA"
        return "Others"
    if u in ("ADMK", "AIADMK", "AIDMK", "BJP", "PMK", "AMMK"): return "AIADMK+BJP+PMK+AMMK"
    if u in ("DMK", "INC", "VCK"): return "DMK+INC+VCK"
    if u == "TVK": return "TVK"
    if u == "NTK": return "NTK"
    if u == "NOTA": return "NOTA"
    return "Others"

# ---------------- survey workbook ----------------
wb = openpyxl.load_workbook(SURVEY, read_only=True, data_only=True)
ws = wb["Exit Poll"]
it = ws.iter_rows(values_only=True)
headers = [str(x or "").strip() for x in next(it)]
idx = {h: i for i, h in enumerate(headers)}
rows = []
for raw in it:
    if not any(raw): continue
    r = {h: raw[idx[h]] if idx[h] < len(raw) else "" for h in headers}
    rows.append(r)
wb.close()
# QA
ids = Counter(str(r.get("Response ID") or "") for r in rows)
dups = sum(1 for k, n in ids.items() if k and n > 1)
status_counts = Counter(str(r.get("Response Status") or "") for r in rows)
party_counts = Counter(str(r.get("Party") or "") for r in rows)
iso = [str(r.get("Entry Datetime ISO") or "").strip() for r in rows if str(r.get("Entry Datetime ISO") or "").strip()]
date_min, date_max = min(iso), max(iso)

# AC crosswalk from the active survey (recorded/source-mapped district only)
ac_name = {}
ac_dist_counts = defaultdict(Counter)
for r in rows:
    try: no = int(float(r.get("AC Number") or 0))
    except Exception: no = 0
    if not no: continue
    nm = str(r.get("Assembly Constituency") or "").strip()
    if nm and no not in ac_name: ac_name[no] = nm
    d = canon_district(r.get("District"))
    if d: ac_dist_counts[no][d] += 1
ac_district = {no: c.most_common(1)[0][0] for no, c in ac_dist_counts.items() if c}
# If an AC has no recorded district, use the shapefile/PC as a fallback only for geometry,
# never for survey district aggregation.
missing_dist = sorted(set(range(1, 235)) - set(ac_district))
print("AC crosswalk:", len(ac_name), "ACs, missing recorded districts:", missing_dist)

# ---------------- AC geometry ----------------
sf = shapefile.Reader(SHP)
ac_feats = []
shapes_by_no = {}
for sr in sf.shapeRecords():
    rec = sr.record.as_dict()
    no = int(rec.get("AC_NO") or 0)
    nm = str(rec.get("AC_NAME") or "").strip()
    g = shape(sr.shape.__geo_interface__)
    if not g.is_valid: g = make_valid(g)
    shapes_by_no[no] = g
    c = g.representative_point()
    ac_feats.append({
        "type": "Feature",
        "properties": {"no": no, "name": ac_name.get(no, nm), "district": ac_district.get(no, ""), "centroid": [round(c.x, 6), round(c.y, 6)]},
        "geometry": mapping(g),
    })
ac_feats.sort(key=lambda f: f["properties"]["no"])
json.dump({"type": "FeatureCollection", "features": ac_feats}, open(f"{OUT}/tn-acs.json", "w"), separators=(",", ":"))

# district geometry by unioning AC polygons using the recorded AC→district crosswalk
by_district = defaultdict(list)
for no, g in shapes_by_no.items():
    d = ac_district.get(no)
    if d: by_district[d].append(g)
dist_feats = []
for d, gs in sorted(by_district.items()):
    u = unary_union(gs)
    if not u.is_valid: u = make_valid(u)
    c = u.representative_point()
    dist_feats.append({
        "type": "Feature",
        "properties": {"district": d, "centroid": [round(c.x, 6), round(c.y, 6)], "acs": sum(1 for no in ac_district if ac_district[no] == d)},
        "geometry": mapping(u),
    })
json.dump({"type": "FeatureCollection", "features": dist_feats}, open(f"{OUT}/tn-districts.json", "w"), separators=(",", ":"))
print("geometry:", len(ac_feats), "ACs,", len(dist_feats), "districts")

# ---------------- historical 2011/2016 (TCPD, ECI-derived) ----------------
hist = {y: {} for y in YEARS}
coverage = {}
# The TCPD file contains two blocks for a few constituency/year pairs (a general
# block plus a later/by-poll or duplicate source block). Keep the block with the
# largest valid-vote base, which is the general-election block, and never add the
# two blocks together.
tcpd_rows = []
with open(TCPD, encoding="utf-8-sig") as fh:
    for r in csv.DictReader(fh):
        if r.get("Election_Type") != "AE": continue
        try: y = int(r.get("Year") or 0); no = int(r.get("Constituency_No") or 0)
        except Exception: continue
        if y in (2011, 2016) and 1 <= no <= 234: tcpd_rows.append((y, no, r))
chosen = {}
for y, no, r in tcpd_rows:
    chosen[(y, no)] = max(chosen.get((y, no), 0), num(r.get("Valid_Votes")))
for y, no, r in tcpd_rows:
    if num(r.get("Valid_Votes")) != chosen[(y, no)]: continue
    d = hist[str(y)].setdefault(no, {"valid": 0, "counts": Counter(), "winner": None})
    d["valid"] = max(d["valid"], num(r.get("Valid_Votes")))
    d["counts"][group_of(r.get("Party"), y)] += num(r.get("Votes"))
    if int(num(r.get("Position"))) == 1:
        d["winner"] = group_of(r.get("Party"), y)
for y in ("2011", "2016"):
    coverage[y] = len(hist[y])
    for no, d in hist[y].items():
        d["shares"] = historical_shares(d["counts"], d["valid"])
print("historical coverage:", coverage)

# ---------------- historical 2021 (ECI candidate results) ----------------
with open(ECI2021, encoding="utf-8-sig") as fh:
    for r in csv.DictReader(fh):
        try: no = int(r.get("AC_NO") or 0)
        except Exception: continue
        if not (1 <= no <= 234): continue
        d = hist["2021"].setdefault(no, {"valid": 0, "counts": Counter(), "winner": None})
        votes = num(r.get("Total Votes"))
        d["valid"] += votes
        d["counts"][group_of(r.get("Party Code"), 2021)] += votes
        if int(num(r.get("Position"))) == 1:
            d["winner"] = group_of(r.get("Party Code"), 2021)
coverage["2021"] = len(hist["2021"])
for no, d in hist["2021"].items(): d["shares"] = historical_shares(d["counts"], d["valid"])
print("2021 historical coverage:", coverage["2021"])

# group presence and historical aggregate shares / seats
presence = {}
for y in YEARS:
    present = {}
    for g in GROUPS:
        total = sum(d["counts"].get(g, 0) for d in hist[y].values())
        present[g] = total > 0
    presence[y] = present
# TVK explicitly absent; NTK/NOTA may be absent in 2011
presence["2011"]["TVK"] = False; presence["2016"]["TVK"] = False; presence["2021"]["TVK"] = False
# winners for every available AC/year
winners = {y: {} for y in YEARS}
for y in YEARS:
    for no, d in hist[y].items():
        if d.get("winner"):
            winners[y][no] = d["winner"]

# ---------------- survey aggregation ----------------
valid_status = "Valid"
state_counts = Counter(); state_total = state_valid = 0
district_rows = defaultdict(list); ac_rows = defaultdict(list)
for r in rows:
    st = str(r.get("Response Status") or "")
    party = str(r.get("Party") or "")
    group = party if party in GROUPS else None
    if st == valid_status and group:
        state_valid += 1; state_counts[group] += 1
    d = canon_district(r.get("District"))
    try: no = int(float(r.get("AC Number") or 0))
    except Exception: no = 0
    if d: district_rows[d].append((r, group, no))
    if no: ac_rows[no].append((r, group, d))
state_survey = shares_from_counts(state_counts, state_valid)
recorded_district_valid = 0
estimated_district_valid = 0
ac_scoped_valid = 0
inferred_ac_rows = 0
for r in rows:
    if str(r.get("Response Status") or "") != "Valid": continue
    if str(r.get("District") or "").strip(): recorded_district_valid += 1
    if str(r.get("Geography Basis") or "") == "Estimated allocation": estimated_district_valid += 1
    if str(r.get("AC Number") or "").strip(): ac_scoped_valid += 1
    if "inferred" in str(r.get("AC Status") or "").lower() and str(r.get("AC Number") or "").strip(): inferred_ac_rows += 1

def survey_scope(rows_in):
    counts = Counter(); valid = 0
    for _, g, _ in rows_in:
        if g: counts[g] += 1; valid += 1
    return {"valid": valid, "counts": {g: counts.get(g, 0) for g in GROUPS}, "shares": shares_from_counts(counts, valid)}

# ---------------- compact aggregate bundle ----------------
districts = []
dist_by_ac = defaultdict(list)
for no in range(1, 235):
    d = ac_district.get(no)
    if d: dist_by_ac[d].append(no)
for d in sorted(dist_by_ac):
    acs = dist_by_ac[d]
    actual = {}
    for y in YEARS:
        counts = Counter(); valid = 0.0; available = 0
        for no in acs:
            rec = hist[y].get(no)
            if not rec or not rec.get("valid"): continue
            available += 1; valid += rec["valid"]
            for g, n in rec["counts"].items(): counts[g] += n
        actual[y] = {"shares": historical_shares(counts, valid), "available": available, "total": len(acs)}
    # District scope uses every valid response with a recorded/source-mapped district,
    # including responses whose assembly constituency was not provided.
    scope_rows = district_rows.get(d, [])
    survey = survey_scope(scope_rows)
    seats = {y: Counter() for y in YEARS}
    for y in YEARS:
        for no in acs:
            g = winners[y].get(no)
            if g: seats[y][g] += 1
    districts.append({
        "name": d, "acs": acs,
        "actual": actual,
        "survey": survey,
        "seats": {y: {g: seats[y].get(g, 0) for g in GROUPS} for y in YEARS},
        "coverage": {y: actual[y]["available"] for y in YEARS},
    })

ac_out = []
for no in range(1, 235):
    d = ac_district.get(no, "")
    actual = {}
    for y in YEARS:
        rec = hist[y].get(no)
        actual[y] = {"shares": rec["shares"] if rec else None, "available": bool(rec and rec.get("shares")), "winner": winners[y].get(no)}
    scope_rows = ac_rows.get(no, [])
    survey = survey_scope(scope_rows)
    leader = None
    if survey["valid"]:
        leader = max(GROUPS, key=lambda g: survey["counts"].get(g, 0))
    ac_out.append({
        "no": no, "name": ac_name.get(no, f"AC {no}"), "district": d,
        "actual": actual, "survey": survey, "surveyLeader": leader if survey["valid"] else None,
    })

state_actual = {}
state_seats = {y: Counter() for y in YEARS}
for y in YEARS:
    counts = Counter(); valid = 0.0; available = 0
    for no, rec in hist[y].items():
        if not rec.get("valid"): continue
        available += 1; valid += rec["valid"]
        for g, n in rec["counts"].items(): counts[g] += n
    state_actual[y] = {"shares": historical_shares(counts, valid), "available": available, "total": 234}
    for g in winners[y].values(): state_seats[y][g] += 1
state = {
    "name": "Tamil Nadu", "actual": state_actual,
    "seats": {y: {g: state_seats[y].get(g, 0) for g in GROUPS} for y in YEARS},
    "coverage": {y: state_actual[y]["available"] for y in YEARS},
    "survey": {"valid": state_valid, "counts": {g: state_counts.get(g, 0) for g in GROUPS}, "shares": state_survey},
    "surveyLeaders": {g: sum(1 for a in ac_out if a["surveyLeader"] == g) for g in GROUPS},
}
bundle = {
    "version": "tn-2026-exit-poll-v1",
    "source": {
        "survey": {
            "file": os.path.basename(SURVEY), "sha256": hashlib.sha256(open(SURVEY, "rb").read()).hexdigest(),
            "sheet": "Exit Poll", "total": len(rows), "valid": state_valid,
            "blank": status_counts.get("Excluded: blank", 0), "invalid": status_counts.get("Excluded: invalid", 0),
            "dateMin": date_min, "dateMax": date_max, "duplicateIds": dups,
            "recordedDistrictValid": recorded_district_valid, "estimatedDistrictValid": estimated_district_valid,
            "acScopedValid": ac_scoped_valid, "missingAcValid": state_valid - ac_scoped_valid, "inferredAcRows": inferred_ac_rows,
            "note": "The Opinion Poll sheet is empty in the active workbook. The 2026 measure is an exit-poll estimate, not an official result.",
        },
        "history": {
            "2011": {"source": "TCPD Assembly Elections Tamil Nadu (ECI-derived), file version 2020-06-25", "url": "https://raw.githubusercontent.com/R-RP/-Analysis_on_TN_election_-2016_using_pandas/master/TCPD_AE_Tamil%20Nadu_2020-6-25.csv", "assemblies": coverage["2011"], "duplicateBlocksResolved": [140], "note": "A second 2011 block for AC 140 was a duplicate/by-poll-style source block; the general-election block with the larger valid-vote base was retained."},
            "2016": {"source": "TCPD Assembly Elections Tamil Nadu (ECI-derived), file version 2020-06-25", "url": "https://raw.githubusercontent.com/R-RP/-Analysis_on_TN_election_-2016_using_pandas/master/TCPD_AE_Tamil%20Nadu_2020-6-25.csv", "assemblies": coverage["2016"], "missingAcs": [134, 174], "duplicateBlocksResolved": [195], "note": "Aravakurichi and Thanjavur 2016 general-election results are absent from the source; they are shown as no data, not zero. AC 195 had two source blocks; the larger valid-vote block was retained."},
            "2021": {"source": "ECI 2021 candidate results via Election2021 all_candidate dataset", "url": "https://raw.githubusercontent.com/tecoholic/Election2021/master/may2021/TN/all_candidate.csv", "assemblies": coverage["2021"]},
        },
        "geometry": {"source": "india-constituency-maps post-2008 assembly shapefile, Tamil Nadu S22 (ECI-derived)", "url": "https://github.com/skthewimp/india-constituency-maps", "license": "MIT", "assemblies": len(ac_feats), "districts": len(dist_feats)},
        "groups": "The six groups are the active survey's source groups. Individual alliance partners are not split because the active survey only reports combined responses.",
    },
    "groups": GROUPS, "labels": LABELS, "colors": COLORS, "years": YEARS,
    "presence": presence,
    "statewide": state,
    "districts": districts,
    "acs": ac_out,
}
json.dump(bundle, open(f"{OUT}/aggregates.json", "w"), separators=(",", ":"))
print("aggregate:", os.path.getsize(f"{OUT}/aggregates.json"), "bytes")

# ---------------- rounds / daily / 50-block aggregates ----------------
# Include every row with a timestamp in membership; valid party answers form the denominator.
ordered = sorted(rows, key=lambda r: (str(r.get("Entry Datetime ISO") or ""), str(r.get("Response ID") or "")))
all_entries = []
for r in ordered:
    st = str(r.get("Response Status") or "")
    p = str(r.get("Party") or "")
    g = p if (st == "Valid" and p in GROUPS) else None
    d = canon_district(r.get("District"))
    try: no = int(float(r.get("AC Number") or 0))
    except Exception: no = 0
    all_entries.append({"date": str(r.get("Entry Datetime ISO") or ""), "g": g, "district": d, "ac": no})
def counts_for(entries):
    c = Counter(); ans = 0
    for e in entries:
        if e["g"]: c[e["g"]] += 1; ans += 1
    return ans, {g: c.get(g, 0) for g in GROUPS}
def periods_from_defs(defs, scoped):
    out = []
    for d in defs:
        c = [e for e in scoped if d["startPos"] <= e["pos"] < d["endPos"]]
        ans, cnt = counts_for(c)
        out.append({"i": d["i"], "start": d["start"], "end": d["end"], "entries": len(c), "answered": ans, "counts": cnt, "partial": d["partial"]})
    return out
def round_defs(size):
    n = math.ceil(len(all_entries) / size)
    out = []; pos = 0
    for i in range(n):
        end = pos + size if i < n - 1 else len(all_entries)
        chunk = all_entries[pos:end]
        out.append({"i": i + 1, "start": chunk[0]["date"], "end": chunk[-1]["date"], "startPos": pos, "endPos": end, "partial": i == n - 1})
        pos = end
    return out
defs388 = round_defs(388); defs688 = round_defs(688)
for e, idx in zip(all_entries, range(len(all_entries))): e["pos"] = idx

def scope_bundle(name, scoped):
    if not scoped: return None
    daily = defaultdict(list)
    for e in scoped: daily[e["date"][:10]].append(e)
    days = []
    for date in sorted(daily):
        ans, cnt = counts_for(daily[date])
        days.append({"date": date, "entries": len(daily[date]), "answered": ans, "counts": cnt})
    blocks = []
    for i in range(0, len(scoped), 50):
        chunk = scoped[i:i + 50]
        ans, cnt = counts_for(chunk)
        blocks.append({"i": len(blocks) + 1, "start": chunk[0]["date"], "end": chunk[-1]["date"], "entries": len(chunk), "answered": ans, "counts": cnt, "partial": len(chunk) < 50})
    return {"name": name, "entries": len(scoped), "dateMin": scoped[0]["date"][:10], "dateMax": scoped[-1]["date"][:10],
            "rounds388": periods_from_defs(defs388, scoped), "rounds688": periods_from_defs(defs688, scoped),
            "daily": days, "blocks50": blocks}
scopes = {"state": scope_bundle("Tamil Nadu", all_entries)}
for d in sorted(dist_by_ac):
    scoped = [e for e in all_entries if e["district"] == d]
    if scoped: scopes["d:" + d] = scope_bundle(d, scoped)
for no in sorted(ac_rows):
    scoped = [e for e in all_entries if e["ac"] == no]
    if scoped: scopes["a:" + str(no)] = scope_bundle(ac_name.get(no, f"AC {no}"), scoped)
rounds = {
    "version": "tn-2026-rounds-v1", "parties": GROUPS,
    "entries": len(all_entries), "dateMin": date_min, "dateMax": date_max,
    "roundPolicy": "ceil(entries / sample size); every round except the final has the nominal size; the final round is the exact remainder.",
    "model": {"kind": "survey-only", "reason": "The active workbook has no recalled previous-election vote and no validated prediction model; do not apply the Telangana projection formula.", "projection": False},
    "scopes": scopes,
}
json.dump(rounds, open(f"{OUT}/rounds.json", "w"), separators=(",", ":"))
print("rounds:", os.path.getsize(f"{OUT}/rounds.json"), "bytes; entries", len(all_entries), "scopes", len(scopes), "state rounds", len(scopes["state"]["rounds388"]), len(scopes["state"]["rounds688"]))
print("state survey", state_survey)
print("state seats", state["seats"])
print("state leaders", state["surveyLeaders"])
