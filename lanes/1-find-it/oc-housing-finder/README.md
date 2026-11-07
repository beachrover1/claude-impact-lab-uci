# OC Housing Finder (code)

The project overview, how to run it, sources, ASSUMPTIONS and known gaps are in the
[README at the top of the repo](../../../README.md).

| Folder | What's in it |
|---|---|
| [`rules/`](rules) | Law site tests with HCD fact-sheet quotes (`laws.json`), and the Santa Ana zone mapping (`city-santa-ana.json`) |
| [`pipeline/`](pipeline) | `fetch_data.py` downloads and caches public layers; `screen.py` runs every test on every parcel |
| [`app/`](app) | Next.js + Leaflet app; screened data is in `app/public/data/` |

Prototype only. Not legal, zoning or financial advice.
