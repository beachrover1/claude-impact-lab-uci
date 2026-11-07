"""Small, polite ArcGIS REST downloader with on-disk caching.

Every layer is downloaded once into data/raw/<name>.geojson. Re-running a fetch
reuses the cached file unless --refresh is passed. Requests are paged (the
servers cap results at 1,000-2,000 per request) and spaced out so we do not
hammer public servers (lab ground rules: "Be kind to public servers").
"""
import json
import os
import time
import warnings

warnings.filterwarnings("ignore")  # macOS LibreSSL notice from urllib3
import requests  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "..", "data", "raw")
UA = {"User-Agent": "oc-housing-finder-hackathon/0.1 (Claude Impact Lab prototype)"}
PAUSE_S = 0.4


def _get(url, params, tries=4):
    for i in range(tries):
        try:
            r = requests.get(url, params=params, headers=UA, timeout=120)
            r.raise_for_status()
            d = r.json()
            if "error" in d:
                raise RuntimeError(d["error"])
            return d
        except Exception as e:  # FEMA times out on first call; retry
            if i == tries - 1:
                raise
            print(f"   retry {i + 1} after error: {e}")
            time.sleep(2 * (i + 1))


def fetch_layer(name, layer_url, where="1=1", out_fields="*", geometry=None,
                page=1000, refresh=False, return_geometry=True):
    """Download a layer as GeoJSON (EPSG:4326). `geometry` is an optional
    envelope (xmin, ymin, xmax, ymax) in lon/lat to clip the query."""
    os.makedirs(RAW, exist_ok=True)
    path = os.path.join(RAW, f"{name}.geojson")
    if os.path.exists(path) and not refresh:
        print(f"[cache] {name}")
        with open(path) as f:
            return json.load(f)

    base = {"where": where, "outFields": out_fields, "outSR": 4326,
            "returnGeometry": str(return_geometry).lower(), "f": "geojson"}
    if geometry:
        base.update({"geometry": ",".join(map(str, geometry)),
                     "geometryType": "esriGeometryEnvelope", "inSR": 4326,
                     "spatialRel": "esriSpatialRelIntersects"})

    count = _get(layer_url + "/query", {**{k: v for k, v in base.items() if k != "f"},
                                        "returnCountOnly": "true", "f": "json"})["count"]
    print(f"[fetch] {name}: {count} features")
    feats, offset = [], 0
    while offset < count:
        d = _get(layer_url + "/query", {**base, "resultOffset": offset,
                                        "resultRecordCount": page})
        got = d.get("features", [])
        if not got:
            break
        feats.extend(got)
        offset += len(got)
        print(f"   {offset}/{count}")
        time.sleep(PAUSE_S)

    fc = {"type": "FeatureCollection", "features": feats,
          "_source": {"url": layer_url, "where": where,
                      "fetched": time.strftime("%Y-%m-%d")}}
    with open(path, "w") as f:
        json.dump(fc, f)
    return fc
