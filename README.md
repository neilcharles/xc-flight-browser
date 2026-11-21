# UK XC Browser

A map of UK paragliding cross-country flights from the [XC League](https://www.xcleague.com/).
It replaces the old R Shiny app. This version is a static Svelte site, so it can be hosted on GitHub Pages with no server.

Only solo paraglider flights are shown: tandem and hang glider flights are dropped when the data loads.
Pilot names are not included. The site has no pilot filter, and the published data file holds no names.
Each flight's popup links to its page on the XC League.

## Develop

    npm install
    npm run dev        # http://localhost:5173
    npm test           # filter, URL and popup logic
    npm run check      # type check
    npm run build      # static site in dist/

## Data

`public/data/flights.json` is generated, then committed. Rebuild it with:

    Rscript scripts/export_data.R [flights.csv] [uk_pg_sites dir]

The paths default to `../uk_pg_sites/wind/xc_flights_to_2025.csv` (the wingman-scraper archive) and `../uk_pg_sites`.
The R packages needed are dplyr, readr and jsonlite.

The script does the following:

- **Sites:** downloads the latest [`sites.csv`](https://github.com/neilcharles/uk_pg_sites/blob/main/sites.csv) and matches each flight to the nearest takeoff within 1 km.
  This is the same rule `uk_pg_sites/wind/wind_directions.R` uses.
  A flight with no takeoff that close keeps the takeoff name the pilot entered. The site picker shows these as "not in sites list".
- **Gliders:** cleans the free-text glider names and adds EN ratings. `data-raw/glider_lookup.csv` is wingmanv2's `inst/glider_name_lookup.csv`.
  `data-raw/glider_lookup_additions.csv` covers newer wings, using EN classes checked against manufacturer and retailer pages.
  Matching ignores case, spaces and punctuation. The script prints the most common unmatched names, so new wings can be added to the additions file.
- **UK only:** keeps flights whose takeoff is at a listed site, or within 2 km of the UK outline in `data-raw/uk_boundary.geojson` (Natural Earth 1:10m). Flights abroad are dropped.
- **Flight types:** splits each XC League flight type into a type (FAI triangle, Out & return, …), an aircraft (Paraglider, Tandem, Hang glider) and modifiers (declared, coastal, tow, ridge-run).
- **Wind:** looks up the ERA5 100 m wind at the start hour in `uk_pg_sites/wind/cache/wind`.
  `wind_directions.R` fills that cache, and the export script makes no API calls.
- **Privacy:** removes pilot names and clubs. It stops if any pilot name appears as a string in the output.

The source CSV contains pilot names. `.gitignore` excludes every `*.csv` outside `data-raw/`, so never copy the source CSV into `data-raw/`.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes `dist/` to GitHub Pages.
Before the first run, enable Pages in the repo settings and set the source to **GitHub Actions**.
The site uses relative paths (`base: './'`), so it works from a project subpath such as `user.github.io/xcbrowser/`.

## Shareable links

The query string holds every filter, with only values that differ from the default.
The default is 1 January last year onwards, the same as the Shiny app.
Example: `?from=&site=Long%20Mynd&wind=W&wind=NW&min=50`.
`from=` (empty) means no start date.

## Map of R -> TS

| Shiny app | Here |
|---|---|
| `flights_map.R` filters + `reactive()` | `src/lib/filters.ts`, `src/components/FilterPanel.svelte` |
| leaflet `addPolylines`, `colorBin` | `src/components/FlightMap.svelte`, `src/lib/format.ts` |
| `map_popup` column | `popupHtml()` in `src/lib/format.ts` (no pilot name) |
| top 1000 by distance | longest 2,000 drawn (`MAP_LIMIT`) |
| `utils_load_data.R` | `scripts/export_data.R` -> `public/data/flights.json` |
