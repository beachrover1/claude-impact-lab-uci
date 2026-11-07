"""Download and cache every public layer the screener uses, for one pilot city.

Run:  .venv/bin/python pipeline/fetch_data.py [--refresh]

Sources and their verification status are listed in
lanes/1-find-it/data/DATA-SOURCES.md (checked 2026-11-06 by the organizers).
Privacy: the Santa Ana parcel layer has owner-name and mailing-address fields.
We never request them (lab rule: owner names tied to people are personal info).
"""
import csv
import io
import json
import os
import subprocess
import sys
import time
import warnings

warnings.filterwarnings("ignore")
import requests  # noqa: E402

from arcgis import RAW, UA, fetch_layer  # noqa: E402

REFRESH = "--refresh" in sys.argv
CITY = "Santa Ana"

LAYERS = {
    # Parcels: APN, site address, values. NOT Name / MailAddress (personal info).
    "parcels_sa": dict(
        layer_url="https://gis.santa-ana.org/server/rest/services/Public/GIS_AssessorParcels/MapServer/0",
        out_fields="AssessmentNo,SiteAddress,SiteZip5,LandVal,ImprovedVal,LotType"),
    # Zoning per parcel, regional (SCAG), has local code + acres + slope
    "zoning_scag": dict(
        layer_url="https://maps.scag.ca.gov/scaggis/rest/services/LDX/Zoning_poly_OR/MapServer/0",
        where=f"CITY='{CITY}'", page=2000,
        out_fields="APN24,ACRES,SLOPE,ZN24_CITY,ZN24_SCAG,YEAR_ZN"),
    # City's own zoning polygons (authoritative zone descriptions)
    "zoning_city": dict(
        layer_url="https://gis.santa-ana.org/server/rest/services/Public/PBA_ZoningClassifications/FeatureServer/0",
        out_fields="ZONECLASS,ZONEDESC,ZONEOVERLAY,ORD_NO,ORD_DATE", page=2000),
    # Housing-element sites (adopted inventory)
    "he_sites": dict(
        layer_url="https://maps.scag.ca.gov/scaggis/rest/services/LDX/HousingElementSite_poly_scag/MapServer/0",
        # Checked 2026-11-07: SANTA ANA is not among the 28 OC jurisdictions in this
        # layer, so this returns 0 rows. Kept so other cities work; the app shows the gap.
        where=f"Jurisdiction='{CITY.upper()}'", page=2000,
        out_fields="APN24,Assessor_Parcel_Number,Jurisdiction,Low_Income_HE_Capacity,"
                   "Moderate_Income_HE_Capacity,Above_Moderate_Income_HE_Capacity,Total_HE_Capacity,YEAR"),
}

# Layers clipped to the city's bounding box (computed from the zoning layer)
BBOX_LAYERS = {
    "footprints": dict(
        layer_url="https://www.ocgis.com/arcpub/rest/services/Map_Layers/Building_Footprints/MapServer/0",
        out_fields="Height,City"),
    "flood_fema": dict(
        layer_url="https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28",
        out_fields="FLD_ZONE,ZONE_SUBTY,SFHA_TF", page=500),
    "fire_lra_oc": dict(
        layer_url="https://www.ocgis.com/arcpub/rest/services/Map_Layers/Fire_Hazard_Severity_Zones_LRA/MapServer/0",
        out_fields="HAZ_CODE,HAZ_CLASS,INCORP,SRA"),
    "fire_sra_state": dict(
        layer_url="https://services.gis.ca.gov/arcgis/rest/services/Environment/Fire_Severity_Zones/MapServer/0",
        out_fields="*"),
    "liquefaction": dict(
        layer_url="https://www.ocgis.com/arcpub/rest/services/Map_Layers/Liquefaction/MapServer/0",
        out_fields="QUAD_NAME,RELEASED"),
    "landslide": dict(
        layer_url="https://services2.arcgis.com/zr3KAIbsRSUyARHG/arcgis/rest/services/CGS_Landslide_Zones/FeatureServer/0",
        out_fields="*"),
    "hqta": dict(
        layer_url="https://caltrans-gis.dot.ca.gov/arcgis/rest/services/CHrailroad/CA_HQ_Transit_Areas/FeatureServer/0",
        out_fields="agency_primary,hqta_type,hqta_details"),
}

SURPLUS_CSV_PAGE = "https://data.ca.gov/api/3/action/package_show?id=surplus-land-act-notices-of-availability-received"


def bbox_of(fc):
    xs, ys = [], []

    def walk(c):
        if isinstance(c[0], (int, float)):
            xs.append(c[0]); ys.append(c[1])
        else:
            for cc in c:
                walk(cc)
    for f in fc["features"]:
        if f.get("geometry"):
            walk(f["geometry"]["coordinates"])
    pad = 0.005
    return (min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad)


def fetch_surplus():
    path = os.path.join(RAW, "surplus_land.json")
    if os.path.exists(path) and not REFRESH:
        print("[cache] surplus_land")
        return
    meta = requests.get(SURPLUS_CSV_PAGE, headers=UA, timeout=60).json()["result"]
    csv_res = [r for r in meta["resources"] if (r.get("format") or "").upper() == "CSV"][0]
    print(f"[fetch] surplus_land: {csv_res['url']}")
    text = requests.get(csv_res["url"], headers=UA, timeout=120).text
    rows = list(csv.DictReader(io.StringIO(text)))
    with open(path, "w") as f:
        json.dump({"_source": {"url": csv_res["url"], "dataset": SURPLUS_CSV_PAGE,
                               "last_modified": csv_res.get("last_modified"),
                               "fetched": time.strftime("%Y-%m-%d")},
                   "rows": rows}, f)
    print(f"   {len(rows)} rows statewide")


def fetch_worship(bbox):
    """OpenStreetMap places of worship (ODbL). Proxy for SB 4 land, not a fact."""
    path = os.path.join(RAW, "worship_osm.json")
    if os.path.exists(path) and not REFRESH:
        print("[cache] worship_osm")
        return
    s, w, n, e = bbox[1], bbox[0], bbox[3], bbox[2]
    q = (f'[out:json][timeout:60];(nwr["amenity"="place_of_worship"]({s},{w},{n},{e}););'
         'out center tags;')
    for host in ["https://overpass-api.de/api/interpreter",
                 "https://overpass.kumi.systems/api/interpreter"]:
        for i in range(3):
            try:
                # curl, not requests: macOS's bundled Python (LibreSSL) fails the TLS handshake with overpass-api.de
                res = subprocess.run(["curl", "-sS", "--fail", "--max-time", "120", "-A", UA["User-Agent"],
                                      "--data-urlencode", f"data={q}", host],
                                     capture_output=True, text=True, check=True)
                els = json.loads(res.stdout)["elements"]
                with open(path, "w") as f:
                    json.dump({"_source": {"url": host, "query": q, "license": "ODbL",
                                           "fetched": time.strftime("%Y-%m-%d")},
                               "elements": els}, f)
                print(f"[fetch] worship_osm: {len(els)} places")
                return
            except Exception as ex:
                print(f"   overpass retry ({host}): {ex}")
                time.sleep(5 * (i + 1))
    print("   WARNING: OSM places of worship unavailable; SB 4 proxy will show 'unknown'")


def main():
    for name, kw in LAYERS.items():
        fetch_layer(name, refresh=REFRESH, **kw)
    with open(os.path.join(RAW, "zoning_scag.geojson")) as f:
        bbox = bbox_of(json.load(f))
    print(f"[bbox] {CITY}: {bbox}")
    with open(os.path.join(RAW, "bbox.json"), "w") as f:
        json.dump({"city": CITY, "bbox": bbox}, f)
    for name, kw in BBOX_LAYERS.items():
        try:
            fetch_layer(name, geometry=bbox, refresh=REFRESH, **kw)
        except Exception as e:
            print(f"   WARNING: {name} failed: {e}. Screener will mark these checks 'unknown'.")
    fetch_surplus()
    fetch_worship(bbox)


if __name__ == "__main__":
    main()
