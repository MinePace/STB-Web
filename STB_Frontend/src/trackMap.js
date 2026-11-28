// Which track layout image to show for a circuit, in order of preference:
// 1. the image uploaded in Add / Edit Track (Tracks.LayoutUrl),
// 2. the built-in images in public/track_map (by country + circuit, then by country).
// The track page tries them in order and moves on when one does not load.

const MAP_EXCEPTIONS = {
  "United States": {
    "Circuit of the Americas": "/track_map/United_States_COTA.avif",
    "Miami": "/track_map/United_States_Miami.avif",
    "Las Vegas": "/track_map/United_States_Las_Vegas.avif",
  },
  Italy: {
    "Monza": "/track_map/Italy_Monza.avif",
    "Imola": "/track_map/Italy_Imola.avif",
  },
  Malaysia: {
    "Sepang": "/track_map/Malaysia.png"
  }
};

function slugCountry(c) {
  return encodeURIComponent(String(c).trim().replace(/\s+/g, "_"));
}

function slugTrack(t) {
  return encodeURIComponent(String(t).trim().replace(/\s+/g, "_"));
}

const eqCI = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const incCI = (hay, needle) =>
  String(hay).toLowerCase().includes(String(needle).toLowerCase());

export function getMapCandidates({ Country, Name, LayoutUrl }) {
  const out = [];
  if (LayoutUrl) out.push(LayoutUrl);

  if (Country && MAP_EXCEPTIONS[Country]) {
    const byCountry = MAP_EXCEPTIONS[Country];

    if (byCountry[Name]) out.push(byCountry[Name]);
    else {
      const keys = Object.keys(byCountry);
      const k = keys.find(
        (key) => eqCI(key, Name) || incCI(Name, key) || incCI(key, Name)
      );
      if (k) out.push(byCountry[k]);
    }
  }

  if (Country && Name) {
    out.push(`/track_map/${slugCountry(Country)}_${slugTrack(Name)}.avif`);
  }

  if (Country) {
    out.push(`/track_map/${slugCountry(Country)}.avif`);
  }

  return out;
}
