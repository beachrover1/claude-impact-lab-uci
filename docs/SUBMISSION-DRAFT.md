# Submission form draft: OC Housing Finder

Form: https://claudesocal.com/uci-impact-lab (`#submit`). Due **2:30 PM**.

**Your email:** the one on your team registration (it brings up your team).

**Lane:** 1 Find it

**One-liner:**
For small housing nonprofits with no GIS team: OC Housing Finder screens every Santa Ana parcel against California's land-opening housing laws and turns the results into a ranked call list, showing pass, fail or unknown for every site test, with its source.

**The real user, before and after:**
A one-person acquisitions lead at a small housing nonprofit (a made-up user, from scenario F02 in the lab repo). Before: sites come by luck, when a city calls about surplus land or a church offers its parking lot. Checking whether SB 9, SB 684, SB 1123, AB 2011 or SB 4 applies to one parcel means opening 5–10 maps, and nobody on staff knows GIS. After: they type "vacant single-family lots near transit, at least half an acre", get a ranked list of 18 Santa Ana sites, and open any site to see which law tests pass, which fail, and which public data can't answer, each with its HCD source. They export the list and copy a drafted question to city planning.

**What it does:**
A Python pipeline downloads public layers (Santa Ana parcels without owner fields, city and SCAG zoning, OC building footprints, FEMA flood, CAL FIRE fire zones, liquefaction and landslide zones, Caltrans transit areas, HCD surplus-land notices, OpenStreetMap places of worship) and runs each law's site tests, taken from HCD's April 2026 fact sheets, on all 57,926 parcels. A Next.js + Leaflet workbench then lets you search in plain English (keyword rules), re-weight the score live, see the top 10 as map pins, open a law-by-law breakdown, compare up to 3 sites, ask an assistant that answers only from the screening data, and export a CSV call list. When sources disagree, it says so. Real test case: 1111 N Bristol St, land the city offered as surplus (HCD case SLA0002451). The tool shows it sits in a specific plan, and that the notice and county footprints disagree on whether it's vacant and how big it is.

**Sources and assumptions:**
Laws: HCD Housing Law Fact Sheets, April 2026: SB 9 (Gov. Code 65852.21, 66411.7), SB 4 (65913.16), SB 684/SB 1123 (65852.28, 65913.4.5, 66499.41), AB 2011 (65912.100–65912.140), checked 2026-11-07. Data, all downloaded 2026-11-07: Santa Ana Assessor Parcels and Zoning Classifications; SCAG Zoning_poly_OR (2024); OC Building Footprints; FEMA NFHL; OC Fire Hazard Severity Zones (LRA) and CAL FIRE SRA; CGS liquefaction (OC copy) and landslide zones; Caltrans High-Quality Transit Areas; HCD Surplus Land Act notices (data.ca.gov); OpenStreetMap places of worship (ODbL); Census TIGERweb 2020 Urban Areas. ASSUMPTIONS: score weights 30/25/20/15/10 and the presets; vacant = footprints cover < 2% of the lot; "possibly underused" = improvements < 50% of land value; capacity = acres / 0.5, capped; SB 9-only parcels shown only if vacant or surplus; project-size presets (4–12 homes = 0.15–5 ac); zone categories are our reading of Santa Ana's zone names. Known gaps: Santa Ana's housing-element sites aren't in SCAG's layer; owner type isn't in free data (SB 4 uses places of worship as a lead, not a fact); historic, wetlands, farmland and fault zones aren't loaded, so those tests show unknown; the SB 1123 lot-size limit isn't in the fact sheet; HCD's fact sheets disagree on SB 684's lot size. The search bar and the assistant are rules over the data, not an LLM.

**Public repo URL:** https://github.com/beachrover1/claude-impact-lab-uci

**Video:** upload the MP4/MOV from your screen recording (≤ 2 min, ≤ 500 MB), or paste an unlisted YouTube or Loom link.

**Live demo URL:** leave blank (it runs locally; see "Try it" in the README).
