# Changelog – STB-Web (website)

Versienummers volgen [Semantic Versioning](https://semver.org/lang/nl/):
**groot.middel.klein** — groot = grote vernieuwing, middel = nieuwe functies, klein = reparaties.

Werkwijze: wijzigingen gaan eerst naar branch `dev` (testsite), na akkoord naar `main` (live) met een tag `vX.Y.Z`.

## [Unreleased] (op `dev`)

### Opgelost
- Socials- en taalmenu: "Open ↗" viel buiten het menu.

## [2.1.0] – 2026-11-25

### Nieuw
- **Statistiekenpagina**: filter op seizoen, divisie en sprints; awards (Comeback King, Mr. Consistent, Pechvogel, Iron Man); ranglijsten met tabbladen (top 10); records (zegereeks, podiumreeks, meeste zeges in een seizoen, grootste inhaalrace, grand slams, spannendste en meest dominante titel). Filters staan in de URL, dus een gefilterde pagina is te delen.

## [2.0.0] – 2026-11-25

Eerste genummerde versie. Alles wat hiervoor live stond, telt als 1.x.

### Nieuw
- **Uitslagen invoeren met screenshots:** plak of sleep 1 of 2 screenshots van de uitslag uit het F1-spel. De tekst wordt in de browser uitgelezen (geen AI, gratis). Coureurs en teams worden vergeleken met de database: groen = gevonden, rood = nieuw, paars = automatisch ingevuld.
- **Nieuwe vormgeving** in de stijl van de STB Racing Hub: navigatie bovenaan in plaats van een zijbalk, met een kampioenschapsmenu en een mobiele lade. Nieuwe homepage met laatste race, podium, top 3 per divisie en league-cijfers.
- **Seizoenen automatisch uit de database:** een nieuw seizoen verschijnt vanzelf in het menu en op de homepage.
- **Titels en beschrijvingen per pagina**, plus **link-previews** in Discord en WhatsApp met een eigen preview-afbeelding (podium, stand of statistieken).
- `sitemap.xml` en `robots.txt` voor zoekmachines.
- Versienummer onderin de site.
- Testsite (branch `dev`) met een eigen testdatabase en een gele **TEST SITE**-badge.

### Verbeterd
- **Sneller:** elke pagina laadt alleen zijn eigen code. Bestanden blijven een jaar in de browsercache.
- Opslaan van een uitslag is alles-of-niets. Nieuwe coureurs moeten eerst bevestigd worden.
- Registreren, historie, circuits, coureur claimen en vlag wijzigen lopen via de nieuwe API (de oude Fly.io-server is uitgezet).
- Vlag wijzigen en coureur claimen kan alleen nog door de eigenaar of een admin.

### Opgelost
- Adminpagina's crashten ("setToken is not defined").
- Racepagina deed een overbodige aanvraag naar de uitgezette server.

### Beveiliging
- Databasebestanden uit de repository verwijderd.
- Wachtwoorden worden met bcrypt opgeslagen (oude wachtwoorden worden bij inloggen automatisch omgezet).
