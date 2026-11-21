# Build public/data/flights.json for the XC Browser site from the wingman-scraper flight archive.
#
# Usage (from the repo root):
#   Rscript scripts/export_data.R [flights.csv] [uk_pg_sites dir]
# Defaults: ../uk_pg_sites/wind/xc_flights_to_2025.csv and ../uk_pg_sites
#
# The flights CSV contains pilot names; it is read here but never copied into this repo, and the
# output is checked to contain none of them before it is written.
#
# Inputs:
#   sites.csv          latest from github.com/neilcharles/uk_pg_sites (local copy if offline)
#   data-raw/glider_lookup.csv            raw glider text -> clean glider_name + en_rating (from wingmanv2)
#   data-raw/glider_lookup_additions.csv  the same for wings newer than that lookup
#   data-raw/uk_boundary.geojson          UK outline (Natural Earth 1:10m); flights taking off outside it (and not at a listed site) are dropped
#   <uk_pg_sites>/wind/cache/wind/*.json   ERA5 100 m wind, as fetched by wind/wind_directions.R

suppressPackageStartupMessages({library(dplyr); library(readr); library(jsonlite)})

args <- commandArgs(TRUE)
flights_path <- if (length(args) > 0) args[1] else "../uk_pg_sites/wind/xc_flights_to_2025.csv"
sites_dir    <- if (length(args) > 1) args[2] else "../uk_pg_sites"
out_path     <- "public/data/flights.json"
sites_url    <- "https://raw.githubusercontent.com/neilcharles/uk_pg_sites/main/sites.csv"
wind_dir     <- file.path(sites_dir, "wind/cache/wind")
MAX_MATCH_KM <- 1

pts <- c("N","NE","E","SE","S","SW","W","NW")
to_sector <- function(deg) (floor((deg + 22.5) / 45) %% 8)          # 0 = N ... 7 = NW
hav <- function(lat1, lon1, lat2, lon2) {
  r <- pi/180; dlat <- (lat2-lat1)*r; dlon <- (lon2-lon1)*r
  a <- sin(dlat/2)^2 + cos(lat1*r)*cos(lat2*r)*sin(dlon/2)^2
  2*6371*asin(pmin(1, sqrt(a)))
}
clean_text <- function(x) {
  x <- gsub("<[^>]*>.*$", "", x)          # "OS Landranger<div ...>JavaScript required</div>"
  x <- gsub("\\\\", "", x)                # King\'s -> King's
  x <- gsub("\\s+", " ", trimws(x))
  x[x %in% c("OS Landranger", "NA")] <- ""
  ifelse(is.na(x), "", x)
}
# Most common spelling within case-insensitive groups, so "Blease fell" and "Blease Fell" merge
canonical <- function(x) {
  key <- tolower(x)
  best <- tibble(key, x) %>% count(key, x) %>% arrange(key, desc(n), x) %>%
    distinct(key, .keep_all = TRUE)
  best$x[match(key, best$key)]
}

# ---- sites ----
sites_csv <- tryCatch({
  tmp <- tempfile(fileext = ".csv"); download.file(sites_url, tmp, quiet = TRUE); tmp
}, error = function(e) { message("sites.csv download failed, using local copy"); file.path(sites_dir, "sites.csv") })
sites <- read_csv(sites_csv, show_col_types = FALSE, col_types = cols(.default = col_character())) %>%
  mutate(takeoff_lat = as.numeric(takeoff_lat), takeoff_lon = as.numeric(takeoff_lon))

# ---- flights ----
raw <- read_csv(flights_path, show_col_types = FALSE,
                col_types = cols(.default = col_character()))
pilot_names <- unique(raw$pilot_name)
num <- function(x) suppressWarnings(as.numeric(x))
fl <- raw %>%
  select(-pilot_name, -club) %>%
  mutate(across(c(distance_via_turnpoints, ends_with("_lat"), ends_with("_lon")), num),
         date = as.Date(sub("^(\\d+)(st|nd|rd|th) ", "\\1 ", flight_date), "%d %B %Y")) %>%
  filter(!is.na(distance_via_turnpoints), !is.na(date), !is.na(takeoff_lat))
rm(raw)

message(nrow(fl), " flights with a distance, ", format(min(fl$date)), " to ", format(max(fl$date)))

hm_to_min <- function(x) {
  m <- regmatches(x, regexec("^(\\d{1,2}):(\\d{2})", x))
  vapply(m, function(v) if (length(v) == 3) as.integer(v[2]) * 60L + as.integer(v[3]) else NA_integer_, 0L)
}
dur_to_min <- function(x) {
  h <- num(sub(".*?(\\d+)\\s*hrs?.*", "\\1", ifelse(grepl("hr", x), x, NA)))
  m <- num(sub(".*?(\\d+)\\s*mins?.*", "\\1", ifelse(grepl("min", x), x, NA)))
  out <- coalesce(h, 0) * 60 + coalesce(m, 0)
  ifelse(is.na(h) & is.na(m), NA, out)
}
fl <- fl %>% mutate(start_min = hm_to_min(start_time), dur_min = as.integer(dur_to_min(duration)))

# ---- site match ----
nn <- vapply(seq_len(nrow(fl)), function(i) {
  d <- hav(fl$takeoff_lat[i], fl$takeoff_lon[i], sites$takeoff_lat, sites$takeoff_lon)
  j <- which.min(d); c(j, d[j])
}, numeric(2))
fl$site_idx <- ifelse(nn[2, ] <= MAX_MATCH_KM, nn[1, ], NA)
fl$takeoff_clean <- canonical(clean_text(fl$takeoff_location))
fl$site_name <- ifelse(is.na(fl$site_idx), fl$takeoff_clean, sites$takeoff_name[fl$site_idx])
fl$site_name[fl$site_name == ""] <- "Unknown takeoff"
message(sprintf("site match <= %d km: %.1f%%", MAX_MATCH_KM, 100 * mean(!is.na(fl$site_idx))))

# ---- UK only: takeoff at a sites.csv site, or within 2 km of the UK outline (Natural Earth 1:10m;
# the margin keeps cliff-top coastal takeoffs) ----
uk <- sf::st_read("data-raw/uk_boundary.geojson", quiet = TRUE) |>
  sf::st_transform(27700) |> sf::st_buffer(2000) |> sf::st_union()
takeoffs <- sf::st_as_sf(fl, coords = c("takeoff_lon", "takeoff_lat"), crs = 4326, remove = FALSE) |>
  sf::st_transform(27700)
in_uk <- !is.na(fl$site_idx) | lengths(sf::st_intersects(takeoffs, uk)) > 0
message(sprintf("dropped %d flights with a takeoff outside the UK", sum(!in_uk)))
fl <- fl[in_uk, ]
rm(takeoffs)

# ---- glider lookup ----
# glider_lookup.csv is wingmanv2's inst/glider_name_lookup.csv; glider_lookup_additions.csv adds
# newer wings (it wins on conflicts). Keys are matched ignoring case, spaces and punctuation.
gnorm <- function(x) gsub("[^a-z0-9]", "", tolower(x))
lk <- bind_rows(
  read_csv("data-raw/glider_lookup_additions.csv", show_col_types = FALSE, col_types = cols(.default = col_character())),
  read_csv("data-raw/glider_lookup.csv", show_col_types = FALSE, col_types = cols(.default = col_character()))
) %>% mutate(key = gnorm(glider)) %>% distinct(key, .keep_all = TRUE)
gi <- match(gnorm(fl$glider), lk$key)
fl$glider_name <- ifelse(is.na(gi), canonical(clean_text(fl$glider)), lk$glider_name[gi])
fl$glider_name[is.na(fl$glider_name) | fl$glider_name == ""] <- "Unknown"
fl$en_rating <- ifelse(is.na(gi) | is.na(lk$en_rating[gi]) | lk$en_rating[gi] == "", "Unknown", lk$en_rating[gi])
message(sprintf("glider lookup match: %.1f%% of flights; EN known: %.1f%%",
                100 * mean(!is.na(gi)), 100 * mean(fl$en_rating != "Unknown")))
unmatched <- sort(table(fl$glider_name[is.na(gi)]), decreasing = TRUE)
if (length(unmatched)) {
  message("most common unmatched gliders:")
  print(head(unmatched, 30))
}

# ---- flight type -> type, craft, modifier flags ----
ft <- fl$flight_type
fl$craft <- case_when(grepl("Tandem Paraglider", ft) ~ "Tandem",
                      grepl("Hang Glider", ft) ~ "Hang glider",
                      TRUE ~ "Paraglider")
base <- sub(" on a .*$", "", ft)
base <- gsub("^(Coastal|Declared|Tow-launch) ", "", base)
base <- gsub("^(Coastal|Declared|Tow-launch) ", "", base)
base <- sub(" Ridge-Run$", "", base)
fl$type <- recode(base, "Turnpoint Flight" = "Turnpoint", "Out and Return" = "Out & return",
                  "Flat Triangle" = "Flat triangle", "FAI Triangle" = "FAI triangle",
                  "Open Distance" = "Open distance", "Flight to Goal" = "Flight to goal",
                  "Competition Goal" = "Competition")
fl$mods <- as.integer(grepl("Declared", ft)) * 1L + as.integer(grepl("Coastal", ft)) * 2L +
  as.integer(grepl("Tow-launch", ft)) * 4L + as.integer(grepl("Ridge-Run", ft)) * 8L

# ---- ERA5 wind at the start hour ----
cell_lat <- round(ifelse(is.na(fl$site_idx), fl$takeoff_lat, sites$takeoff_lat[fl$site_idx]) * 2) / 2
cell_lon <- round(ifelse(is.na(fl$site_idx), fl$takeoff_lon, sites$takeoff_lon[fl$site_idx]) * 2) / 2
blk_start <- as.Date((as.integer(fl$date) %/% 14) * 14)
wfile <- file.path(wind_dir, sprintf("%s_%s_%s.json", cell_lat, cell_lon, blk_start))
wtime <- sprintf("%sT%02d:00", format(fl$date), fl$start_min %/% 60)
fl$wind_dir <- NA_integer_; fl$wind_spd <- NA_integer_
have <- !is.na(fl$start_min) & file.exists(wfile)
for (f in unique(wfile[have])) {
  w <- fromJSON(f)
  rows <- which(have & wfile == f)
  k <- match(wtime[rows], unlist(w$time))
  d <- num(unlist(w$dir))[k]; s <- num(unlist(w$spd))[k]
  fl$wind_dir[rows] <- ifelse(is.na(d), NA, to_sector(d))
  fl$wind_spd[rows] <- as.integer(round(s))
}
message(sprintf("ERA5 wind found: %.1f%% of flights", 100 * mean(!is.na(fl$wind_dir))))

# ---- paths: takeoff, start, tp1-3, finish, landing; ints x1e4, delta encoded ----
pcols <- c("takeoff", "start", "tp1", "tp2", "tp3", "finish", "landing")
lat_m <- round(as.matrix(fl[paste0(pcols, "_lat")]) * 1e4)
lon_m <- round(as.matrix(fl[paste0(pcols, "_lon")]) * 1e4)
paths <- lapply(seq_len(nrow(fl)), function(i) {
  ok <- !is.na(lat_m[i, ]) & !is.na(lon_m[i, ])
  la <- lat_m[i, ok]; lo <- lon_m[i, ok]
  keep <- c(TRUE, diff(la) != 0 | diff(lo) != 0)
  la <- la[keep]; lo <- lo[keep]
  as.integer(c(rbind(c(la[1], diff(la)), c(lo[1], diff(lo)))))
})

# ---- dictionaries ----
dict <- function(x) { lv <- sort(unique(x)); list(levels = lv, idx = match(x, lv) - 1L) }
site_d <- dict(fl$site_name); glider_d <- dict(fl$glider_name)
en_levels <- c("EN A", "EN B", "EN C", "EN D/Comp", "Mini", "Tandem", "Unknown")
en_levels <- c(en_levels[en_levels %in% fl$en_rating], setdiff(sort(unique(fl$en_rating)), en_levels))
type_levels <- names(sort(table(fl$type), decreasing = TRUE))
craft_levels <- c("Paraglider", "Tandem", "Hang glider")
fl$landing_clean <- canonical(clean_text(fl$landing_location))
land_d <- dict(fl$landing_clean)

site_info <- lapply(seq_along(site_d$levels), function(k) {
  nm <- site_d$levels[k]
  j <- match(nm, sites$takeoff_name)
  if (is.na(j)) return(list(n = nm, s = 0L))
  list(n = nm, s = 1L, lat = sites$takeoff_lat[j], lon = sites$takeoff_lon[j],
       g = coalesce(sites$site_guide[j], ""), w = coalesce(sites$wind_directions[j], ""))
})

na_int <- function(x, fill = -1L) { x <- as.integer(x); x[is.na(x)] <- fill; x }
out <- list(
  version = 1L,
  generated = format(Sys.Date()),
  sectors = pts,
  sites = site_info,
  gliders = glider_d$levels,
  en = en_levels,
  types = type_levels,
  crafts = craft_levels,
  landings = land_d$levels,
  flights = list(
    id = as.numeric(fl$flight_index),
    date = as.integer(fl$date),                       # days since 1970-01-01
    start = na_int(fl$start_min),                     # minutes after midnight, local
    dur = na_int(fl$dur_min),                         # minutes
    dist = as.integer(round(fl$distance_via_turnpoints * 100)),  # km x 100
    site = site_d$idx,
    landing = land_d$idx,
    glider = glider_d$idx,
    en = match(fl$en_rating, en_levels) - 1L,
    type = match(fl$type, type_levels) - 1L,
    craft = match(fl$craft, craft_levels) - 1L,
    mods = fl$mods,                                   # 1 declared, 2 coastal, 4 tow, 8 ridge-run
    wdir = na_int(fl$wind_dir),                       # 0 N .. 7 NW, -1 unknown
    wspd = na_int(fl$wind_spd),                       # km/h at 100 m, -1 unknown
    path = paths                                      # [lat0, lon0, dlat1, dlon1, ...] x1e4
  )
)

# ---- privacy guard: no pilot name may appear as any string in the output ----
out_strings <- c(site_d$levels, glider_d$levels, land_d$levels, type_levels, en_levels,
                 unlist(lapply(site_info, function(s) c(s$n, s$g))))
leak <- intersect(out_strings, pilot_names[nchar(pilot_names) > 0])
if (length(leak)) stop("pilot names found in output strings: ", paste(head(leak, 10), collapse = ", "))
json <- toJSON(out, auto_unbox = TRUE, digits = NA)
dir.create(dirname(out_path), recursive = TRUE, showWarnings = FALSE)
writeLines(json, out_path, useBytes = TRUE)
message(sprintf("wrote %s: %d flights, %d sites (%d in sites list), %.1f MB",
                out_path, nrow(fl), length(site_info), sum(sapply(site_info, `[[`, "s")),
                file.size(out_path) / 1e6))
