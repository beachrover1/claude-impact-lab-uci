"""Screen every parcel in the pilot city against each law's site tests.

Run:  .venv/bin/python pipeline/screen.py

Reads the cached layers in data/raw/ and the rules in rules/, writes
app/public/data/parcels.geojson (candidates only) and app/public/data/meta.json.

Every test returns one of: pass / fail / unknown, with the data behind it.
A law is "possible" when no test failed (unknowns remain to be confirmed),
"no" when any test failed. Nothing here is a legal determination.
"""
import json
import math
import os
import re
import time
from collections import Counter, defaultdict

from shapely.geometry import Point, shape, mapping
from shapely.strtree import STRtree

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "app", "public", "data")

M_PER_DEG_LAT = 111_320.0
FT_PER_M = 3.28084

# ---------------------------------------------------------------------------
# ASSUMPTIONS (also listed in the README and shown in the app)
# ---------------------------------------------------------------------------
ASSUMPTIONS = {
    "weights": {
        "value": {"legal": 30, "capacity": 25, "availability": 20, "access": 15, "environment": 10},
        "why": "Illustrative starting weights from the team's concept doc. Not a validated policy. Users can change them in the app."},
    "vacant_coverage": {
        "value": 0.02,
        "why": "A parcel counts as vacant when building footprints cover less than 2% of it (tolerates sheds and footprint edge noise)."},
    "underused_ratio": {
        "value": 0.5,
        "why": "A parcel is flagged 'possibly underused' when its assessed improvement value is under half its land value. A common screening heuristic, not an appraisal."},
    "capacity_acres_full": {
        "value": 0.5,
        "why": "Capacity score is lot acres / 0.5, capped at 1. Half an acre is taken as enough for a 4-12 home project. Not a density calculation."},
    "sb9_only_needs_availability": {
        "value": True,
        "why": "SB 9 alone allows at most 4 units (2 lots x 2 units). For a 4-12 home nonprofit project, parcels whose only pathway is SB 9 are shown only if vacant or on a surplus notice. (The 'underused' value test is too broad in Orange County, where land value dominates most older homes.)"},
    "stale_he_coverage": {
        "value": 0.35,
        "why": "A housing-element site is flagged 'may be stale' when footprints now cover over 35% of it. Footprint vintage is unknown."},
}


def load(name):
    p = os.path.join(RAW, name)
    if not os.path.exists(p):
        print(f"   missing {name}: related checks become 'unknown'")
        return None
    with open(p) as f:
        return json.load(f)


def geoms(fc):
    if fc is None:
        return None
    out = []
    for f in (fc or {}).get("features", []):
        if f.get("geometry"):
            try:
                g = shape(f["geometry"])
                if not g.is_valid:
                    g = g.buffer(0)
                out.append((g, f["properties"]))
            except Exception:
                pass
    return out


class Index:
    """Spatial index. `loaded` is False only when the source file is missing:
    a layer that loaded with zero features means 'checked, none mapped here'."""

    def __init__(self, items, loaded=True):
        self.items = items
        self.loaded = loaded
        self.tree = STRtree([g for g, _ in items]) if items else None

    def hits(self, geom, pred="intersects"):
        if not self.tree:
            return []
        return [self.items[i] for i in self.tree.query(geom, predicate=pred)]


def area_m2(g):
    """Approximate area in m^2 for lon/lat geometry (fine at city scale)."""
    lat = g.centroid.y
    return g.area * (M_PER_DEG_LAT ** 2) * math.cos(math.radians(lat))


def deg_for_ft(ft, lat):
    m = ft / FT_PER_M
    return m / (M_PER_DEG_LAT * math.cos(math.radians(lat)))


def apn8(s):
    return re.sub(r"\D", "", s or "")[:8]


def clean_address(a):
    a = (a or "").strip()
    return None if not a or a.upper() in ("SITUS PENDING", "0") else a


def parse_size_acres(text):
    """Surplus notices store size as text: '9,005 SF', '1.2 acres', '0.5'."""
    if not text:
        return None
    t = text.lower().replace(",", "")
    m = re.search(r"([\d.]+)\s*(sf|sq\.? ?ft|square feet)", t)
    if m:
        return float(m.group(1)) / 43560.0
    m = re.search(r"([\d.]+)\s*(ac|acre)", t)
    if m:
        return float(m.group(1))
    m = re.fullmatch(r"\s*([\d.]+)\s*", t)
    if m:
        return float(m.group(1))
    return None


def main():
    t0 = time.time()
    laws = json.load(open(os.path.join(ROOT, "rules", "laws.json")))
    city = json.load(open(os.path.join(ROOT, "rules", "city-santa-ana.json")))
    zones = city["zones"]

    def zone_info(code):
        if not code:
            return None
        if code in zones:
            return zones[code]
        for k, v in zones.items():
            if k.endswith("*") and code.startswith(k[:-1]):
                return v
        return {"desc": "Not in our zone table", "category": "review"}

    print("loading layers...")
    parcels = geoms(load("parcels_sa.geojson")) or []
    def idx(name):
        items = geoms(load(name))
        return Index(items or [], loaded=items is not None)

    zcity = idx("zoning_city.geojson")
    scag = {apn8(p.get("APN24")): p for _, p in geoms(load("zoning_scag.geojson")) or []}
    he = {}
    for g, p in geoms(load("he_sites.geojson")) or []:
        he[apn8(p.get("APN24") or p.get("Assessor_Parcel_Number"))] = p
    foot = idx("footprints.geojson")
    flood = idx("flood_fema.geojson")
    fire_lra = idx("fire_lra_oc.geojson")
    fire_sra = idx("fire_sra_state.geojson")
    liq = idx("liquefaction.geojson")
    slide = idx("landslide.geojson")
    hqta = idx("hqta.geojson")
    heavy = Index([(g, p) for g, p in zcity.items
                   if (zone_info(p.get("ZONECLASS")) or {}).get("category") == "heavy_industrial"])

    have = {"flood": flood.loaded, "fire": fire_lra.loaded and fire_sra.loaded,
            "foot": foot.loaded, "liq": liq.loaded, "slide": slide.loaded, "hqta": hqta.loaded}

    worship_raw = load("worship_osm.json")
    worship = []
    for e in (worship_raw or {}).get("elements", []):
        lat = e.get("lat") or (e.get("center") or {}).get("lat")
        lon = e.get("lon") or (e.get("center") or {}).get("lon")
        if lat and lon:
            t = e.get("tags", {})
            worship.append((Point(lon, lat), {"religion": t.get("religion"),
                                              "osm": f"https://www.openstreetmap.org/{e['type']}/{e['id']}"}))
    worship_idx = Index(worship, loaded=worship_raw is not None)

    surplus_raw = load("surplus_land.json")
    surplus = {}
    surplus_rows = []
    if surplus_raw:
        for r in surplus_raw["rows"]:
            if (r.get("City") or "").strip().lower() != "santa ana" and \
                    (r.get("Local Agency") or "").strip().lower() != "santa ana":
                continue
            # Contact column names individual staff; we keep the agency and the notice link only.
            keep = ["Parent Case", "Local Agency", "Local Agency Type", "APN", "Address", "Date Notice Issued",
                    "NOA Due Date", "NOA Status", "Notice Website Link", "Parcel Size (Gross Acres)",
                    "General Plan/Zoning", "Existing Use/Vacancy"]
            row = {k: (r.get(k) or "").strip() for k in keep if (r.get(k) or "").strip()}
            row["size_acres_parsed"] = parse_size_acres(r.get("Parcel Size (Gross Acres)") or "")
            row["archived"] = "archive" in (r.get("NOA Status") or "").lower()
            surplus_rows.append(row)
            for a in re.split(r"[;,/&]+|\s+and\s+", r.get("APN") or ""):
                if len(apn8(a)) == 8:
                    surplus[apn8(a)] = row

    print(f"screening {len(parcels)} parcels...")
    out_feats = []
    stats = Counter()
    law_counts = Counter()

    for g, p in parcels:
        apn = p.get("AssessmentNo")
        if not apn or p.get("LotType") != "Lot":
            continue
        c = g.representative_point()
        lat = c.y
        a_m2 = area_m2(g)
        acres = a_m2 / 4046.8564224
        key = apn8(apn)
        sc = scag.get(key, {})

        # --- zoning: city layer is primary, SCAG is the second source
        zc = [pp for gg, pp in zcity.hits(c)]
        zcode = zc[0].get("ZONECLASS") if zc else None
        scag_code = sc.get("ZN24_CITY") or None
        zone_conflict = bool(zcode and scag_code and zcode != scag_code)
        zi = zone_info(zcode or scag_code)
        cats = set()
        if zi:
            cats.add(zi["category"])
            cats.update(zi.get("also", []))

        # --- footprints / vacancy
        bcov = None
        if have["foot"]:
            cov = 0.0
            for fg, _ in foot.hits(g):
                try:
                    cov += area_m2(fg.intersection(g))
                except Exception:
                    pass
            bcov = min(1.0, cov / a_m2) if a_m2 else None
        vacant = None if bcov is None else bcov < ASSUMPTIONS["vacant_coverage"]["value"]

        # --- hazards (use the parcel's interior point; flags are for review)
        fz = [pp for _, pp in flood.hits(c)] if have["flood"] else None
        sfha = None if fz is None else any(str(z.get("SFHA_TF")) == "T" for z in fz)
        flood_zone = ", ".join(sorted({str(z.get("FLD_ZONE")) for z in fz})) if fz else ("none mapped" if fz == [] else None)

        fire_hits = ([pp for _, pp in fire_lra.hits(c)] + [pp for _, pp in fire_sra.hits(c)]) if have["fire"] else None
        fire_classes = sorted({str(z.get("HAZ_CLASS") or z.get("HAZ_CLASS_") or z.get("SRA22_2") or z.get("haz_class") or "") for z in fire_hits or []} - {""})
        vhfhsz = None if fire_hits is None else any("very high" in x.lower() for x in fire_classes)

        liq_hit = None if not have["liq"] else bool(liq.hits(c))
        slide_hit = None if not have["slide"] else bool(slide.hits(c))
        slope = sc.get("SLOPE")
        transit = [pp for _, pp in hqta.hits(c)] if have["hqta"] else None

        near_heavy = None
        if zcity.loaded:
            buf = g.buffer(deg_for_ft(1200, lat))
            near_heavy = bool(heavy.hits(buf))

        w_hits = worship_idx.hits(g) if worship_idx.loaded else None

        he_site = he.get(key)
        sl = surplus.get(key)
        land = float(p.get("LandVal") or 0)
        impr = float(p.get("ImprovedVal") or 0)
        underused = (impr < land * ASSUMPTIONS["underused_ratio"]["value"]) if land > 0 else None

        facts = {
            "zone": zcode, "zone_desc": (zi or {}).get("desc"), "zone_scag_local": scag_code,
            "zone_category": (zi or {}).get("category"), "zone_note": (zi or {}).get("note"),
            "zone_conflict": zone_conflict, "acres": round(acres, 3),
            "building_coverage": None if bcov is None else round(bcov, 3), "vacant": vacant,
            "flood_zone": flood_zone, "sfha": sfha, "fire_classes": fire_classes, "vhfhsz": vhfhsz,
            "liquefaction_zone": liq_hit, "landslide_zone": slide_hit, "slope_scag": slope,
            "transit_hqta": None if transit is None else [t.get("hqta_type") for t in transit][:3],
            "near_heavy_industrial_1200ft": near_heavy,
            "land_value": land or None, "improvement_value": impr if land else None, "possibly_underused": underused,
            "he_site": he_site and {k: he_site.get(k) for k in ("Total_HE_Capacity", "Low_Income_HE_Capacity",
                                                                   "Moderate_Income_HE_Capacity", "Above_Moderate_Income_HE_Capacity", "YEAR")},
            "he_may_be_stale": bool(he_site and bcov is not None and bcov > ASSUMPTIONS["stale_he_coverage"]["value"]),
            "surplus_notice": sl,
            "worship_sites": None if w_hits is None else [pp for _, pp in w_hits][:3],
        }

        # --- run law tests
        def run(t):
            ck, args = t["check"], t.get("args", [])
            if ck == "unknown":
                return "unknown", t.get("why", "")
            if ck == "zone_category_in":
                if not zi:
                    return "unknown", "No zoning found for this parcel."
                if zi["category"] == "review":
                    return "unknown", f"Zone {zcode or scag_code} ({zi['desc']}) needs a person to read the code."
                ok = bool(cats & set(args))
                why = f"Zone {zcode or scag_code}: {zi['desc']}."
                if zone_conflict:
                    why += f" SCAG's 2024 layer says {scag_code}; the city's layer says {zcode}."
                return ("pass" if ok else "fail"), why
            if ck == "city_urbanized":
                return ("pass" if city["urbanized"]["value"] else "fail"), city["urbanized"]["source"]
            if ck == "city_incorporated":
                return ("pass" if city["incorporated"]["value"] else "fail"), city["incorporated"]["source"]
            if ck == "not_sfha":
                if sfha is None:
                    return "unknown", "FEMA flood layer not loaded."
                return ("fail" if sfha else "pass"), f"FEMA NFHL flood zone: {flood_zone or 'none mapped'}."
            if ck == "not_vhfhsz":
                if vhfhsz is None:
                    return "unknown", "Fire hazard layer not loaded."
                return ("fail" if vhfhsz else "pass"), ("Fire hazard class: " + (", ".join(fire_classes) or "none mapped") +
                                                        ". Layer vintage may predate CAL FIRE's 2025 LRA maps.")
            if ck == "acres_max":
                lim = args[0]
                if abs(acres - lim) < 0.02:
                    return "unknown", f"Lot is about {acres:.2f} acres, right at the limit. " + t.get("conflict", "")
                return ("pass" if acres <= lim else "fail"), f"Lot is about {acres:.2f} acres (computed from the parcel outline)."
            if ck == "vacant":
                if vacant is None:
                    return "unknown", "Building footprints not loaded."
                return ("pass" if vacant else "fail"), f"Buildings cover {bcov:.0%} of the lot (OC Building Footprints)."
            if ck == "not_near_zone":
                if near_heavy is None:
                    return "unknown", "Zoning not loaded."
                return ("fail" if near_heavy else "pass"), ("Heavy-industrial (M2) zoning within 1,200 ft." if near_heavy
                                                            else "No heavy-industrial (M2) zoning within 1,200 ft.")
            if ck == "worship_proxy":
                if w_hits is None:
                    return "unknown", "Places-of-worship data not loaded."
                if w_hits:
                    # Names are not shown: some OSM entries carry what look like personal names.
                    links = ", ".join(h[1]["osm"] for h in w_hits[:2])
                    return "lead", (f"OpenStreetMap maps {len(w_hits)} place(s) of worship on this parcel ({links}). "
                                    "Who owns the land, and since when, is not confirmed.")
                return "unknown", "No place of worship mapped here. Ownership is not in free parcel data."
            return "unknown", "Check not implemented."

        results = {}
        any_open = False
        best_legal = 0.0
        for law in laws["laws"]:
            tests = []
            for t in law["tests"]:
                st, why = run(t)
                # Static "why" texts live in rules/laws.json; only store dynamic ones.
                tests.append({"id": t["id"], "status": st, "why": "" if why == t.get("why") else why})
            stc = Counter(x["status"] for x in tests)
            gate = tests[0]["status"]  # first test is the gate: zone category, or ownership for SB 4
            if stc["fail"]:
                status = "no"
            elif law["id"] == "SB4" and gate != "lead":
                status = "no_lead"  # SB 4 needs an ownership lead to be worth showing
            elif gate == "unknown":
                status = "unclear"  # zone needs a person to read the code
            else:
                status = "possible"
            results[law["id"]] = {"status": status, "tests": tests,
                                  "pass": stc["pass"] + stc["lead"], "unknown": stc["unknown"], "fail": stc["fail"]}
            if status in ("possible", "unclear"):
                any_open = True
            if status == "possible":
                best_legal = max(best_legal, (stc["pass"] + stc["lead"]) / len(tests))

        if not any_open:
            stats["no_pathway"] += 1
            continue

        # ASSUMPTION sb9_only_needs_availability: SB 9 alone yields at most 4 units, so for a
        # 4-12 home nonprofit user we keep SB 9-only parcels only if vacant, underused or surplus.
        possible_ids = {k for k, v in results.items() if v["status"] == "possible"}
        if possible_ids == {"SB9"} and not (vacant or sl):
            stats["sb9_only_filtered"] += 1
            continue
        for lid in possible_ids:
            law_counts[lid] += 1

        # --- score components (0..1), weights applied in the app
        cap = min(1.0, acres / ASSUMPTIONS["capacity_acres_full"]["value"])
        if he_site and (he_site.get("Total_HE_Capacity") or 0) >= 4:
            cap = 1.0
        avail = 0.0
        if vacant:
            avail = 1.0
        elif underused:
            avail = 0.6
        if sl and not sl["archived"]:
            avail = 1.0
        if he_site and not facts["he_may_be_stale"]:
            avail = max(avail, 0.7)
        access = 1.0 if transit else (0.0 if transit is not None else 0.5)
        env_flags = [sfha, vhfhsz, liq_hit, slide_hit, (slope or 0) > 15 if slope is not None else None]
        known = [x for x in env_flags if x is not None]
        env = 1.0 - (sum(1 for x in known if x) / len(known)) if known else 0.5

        unknown_total = sum(r["unknown"] for r in results.values() if r["status"] == "possible")
        label = "Potentially suitable"
        if sfha or vhfhsz or slide_hit or facts["he_may_be_stale"] or zone_conflict:
            label = "Needs review"
        if zi is None or (zi.get("category") == "review"):
            label = "Not enough data"

        gs = g.simplify(0.00002, preserve_topology=True)
        out_feats.append({
            "type": "Feature",
            "geometry": json.loads(json.dumps(mapping(gs), default=float), parse_float=lambda x: round(float(x), 6)),
            "properties": {
                "apn": apn, "address": clean_address(p.get("SiteAddress")), "zip": p.get("SiteZip5"),
                "label": label,
                "laws": {k: v["status"] for k, v in results.items()},
                "components": {"legal": round(best_legal, 3), "capacity": round(cap, 3), "availability": round(avail, 3),
                               "access": round(access, 3), "environment": round(env, 3)},
                "unknowns": unknown_total,
                "flags": {"vacant": vacant, "underused": underused, "he_site": bool(he_site),
                          "he_stale": facts["he_may_be_stale"], "surplus": bool(sl), "worship_lead": bool(w_hits),
                          "sfha": sfha, "vhfhsz": vhfhsz, "transit": bool(transit), "zone_conflict": zone_conflict},
                "acres": round(acres, 3), "zone": zcode or scag_code,
                "zcat": (zi or {}).get("category"),
                # County assessed land value. NOT a market price (Prop 13 caps assessments).
                "land_value": int(land) if land > 0 else None,
            },
            "_detail": {"facts": facts, "results": results},
        })
        stats[label] += 1

    # --- split: light map file + per-parcel detail file
    os.makedirs(OUT, exist_ok=True)
    details = {}
    for f in out_feats:
        d = f.pop("_detail")
        d["facts"] = {k: v for k, v in d["facts"].items() if v not in (None, False, [], "")}
        d["results"] = {lid: {"status": r["status"],
                              "tests": [[t["id"], t["status"][0], t["why"]] if t["why"] else [t["id"], t["status"][0]]
                                        for t in r["tests"]]}
                        for lid, r in d["results"].items()}
        details[f["properties"]["apn"]] = d
    with open(os.path.join(OUT, "parcels.geojson"), "w") as fh:
        json.dump({"type": "FeatureCollection", "features": out_feats}, fh, separators=(",", ":"))
    # detail split into shards by APN book (first 3 digits) to keep each file small
    shards = defaultdict(dict)
    for apn, d in details.items():
        shards[apn[:3]][apn] = d
    os.makedirs(os.path.join(OUT, "detail"), exist_ok=True)
    for book, d in shards.items():
        with open(os.path.join(OUT, "detail", f"{book}.json"), "w") as fh:
            json.dump(d, fh, separators=(",", ":"))

    def src(name):
        d = load(name)
        return (d or {}).get("_source")

    meta = {
        "city": city["city"], "generated": time.strftime("%Y-%m-%d %H:%M"),
        "counts": {"parcels_screened": len(parcels), "candidates": len(out_feats), **stats},
        "law_counts": law_counts, "assumptions": ASSUMPTIONS, "laws": laws, "city_rules": city,
        "layers": {n: src(n + ".geojson") for n in ["parcels_sa", "zoning_city", "zoning_scag", "he_sites", "footprints",
                                                     "flood_fema", "fire_lra_oc", "fire_sra_state", "liquefaction",
                                                     "landslide", "hqta"]},
        "layers_extra": {"surplus_land": (surplus_raw or {}).get("_source"),
                         "worship_osm": (worship_raw or {}).get("_source")},
        "surplus_santa_ana": surplus_rows,
        "data_gaps": [
            "Santa Ana's housing-element sites are not in SCAG's HousingElementSite layer (28 other OC jurisdictions are; checked 2026-11-07). Housing-element flags are therefore empty for Santa Ana.",
            "Owner type (needed for SB 4) is not in free parcel data. Places of worship from OpenStreetMap are used as a lead, not a fact.",
            "No historic-district, wetlands, farmland or earthquake-fault layer is loaded. Those tests show 'unknown'.",
            "Tenancy history (SB 9, SB 684) is not public and would be personal information. Always 'unknown'.",
            "Fire hazard zones come from the OC county LRA copy and CAL FIRE's statewide SRA layer. CAL FIRE's 2025 LRA maps were not loaded.",
        ],
    }
    # --- overlay layers for the map toggles (small, simplified)
    os.makedirs(os.path.join(OUT, "layers"), exist_ok=True)

    def dump_layer(name, items, keep):
        feats = []
        for g, pr in items:
            gs = g.simplify(0.00005, preserve_topology=True)
            feats.append({"type": "Feature", "properties": {k: pr.get(k) for k in keep},
                          "geometry": json.loads(json.dumps(mapping(gs)), parse_float=lambda x: round(float(x), 5))})
        with open(os.path.join(OUT, "layers", name), "w") as fh:
            json.dump({"type": "FeatureCollection", "features": feats}, fh, separators=(",", ":"))

    # HQTA polygons overlap heavily; merge them into one shape so the map overlay isn't stacked
    from shapely.ops import unary_union
    merged = unary_union([g for g, _ in hqta.items]) if hqta.items else None
    dump_layer("transit_hqta.geojson", [(merged, {"hqta_type": "merged high-quality transit areas"})] if merged else [],
               ["hqta_type"])
    dump_layer("flood_sfha.geojson", [(g, pr) for g, pr in flood.items if str(pr.get("SFHA_TF")) == "T"],
               ["FLD_ZONE", "ZONE_SUBTY"])

    with open(os.path.join(OUT, "meta.json"), "w") as fh:
        json.dump(meta, fh, indent=1, default=str)
    print(f"done in {time.time() - t0:.0f}s: {dict(stats)}; per law: {dict(law_counts)}")


if __name__ == "__main__":
    main()
