# Changelog – STB-Web (website)

Versienummers volgen [Semantic Versioning](https://semver.org/lang/nl/):
**groot.middel.klein** — groot = grote vernieuwing, middel = nieuwe functies, klein = reparaties.

Werkwijze: wijzigingen gaan eerst naar branch `dev` (testsite), na akkoord naar `main` (live) met een tag `vX.Y.Z`.

## [Unreleased] (op `dev`)

### Veranderd (admin)
- Racepagina **📸 Screenshot + post to Discord** en kampioenschap **Download + post to Discord**: de afbeelding gaat naar de API, die hem opslaat én zelf in het Discord-kanaal van de tier zet (opnieuw uploaden van dezelfde ronde werkt het bericht bij). Na afloop staat naast de knop of het gelukt is. De website roept de bot niet meer aan op `localhost:3000`, dus het werkt zonder dat de bot op een eigen computer draait.
- Niet-admins downloaden alleen de afbeelding (er wordt niets meer geüpload).

## [2.5.0] – 2026-11-28

### Nieuw (admin)
- Dashboard, data-check: knop **Merge** achter elke groep mogelijk dubbele coureurs. Kies welke coureur blijft (standaard de naam die het laatst gebruikt is) en eventueel een nieuwe naam; daarna verdwijnt de groep uit de lijst.

## [2.4.0] – 2026-11-28

### Nieuw (admin)
- **Add Results sneller**: opent direct op de eerstvolgende race zonder uitslag; lijst "To do" met alle gereden races zonder uitslag; laadt alleen open races (i.p.v. alle ±9.500 uitslagen).
- Statusbalk onderaan (blijft in beeld): aantal coureurs, "✓ alles herkend" of "⚠ x rijen controleren" met sprong naar de rij, waarschuwing bij 0 of meerdere snelste ronden.
- Na opslaan: blijft op de pagina met "Bekijk race", "Kopieer link" en **"Volgende: … →"**.
- Nieuwe coureurs bevestigen in de pagina (geen browser-pop-up); foutmeldingen in de pagina.
- Waarschuwing bij weggaan of van race wisselen met niet-opgeslagen invoer.
- **Edit Results vernieuwd**: race kiezen via "Latest"-knoppen of zoeken (circuit, S31, D2…); coureur met aanvulling + groen/rood; team-keuzelijst; ↑ ↓ om te verplaatsen met ▲/▼ t.o.v. de oude positie; coureur toevoegen/verwijderen; snelste ronde aan te passen; **straffen**: seconden invullen → "Re-order by time" zet de volgorde op tijd + straf, punten en tijdsverschillen rekenen mee; overzicht van alle wijzigingen (ook punten) vóór opslaan; alles-of-niets opslaan; "Undo all".
- Ongewijzigde rijen houden hun opgeslagen punten (oudere seizoenen hadden soms andere puntenregels).
- **Admin-dashboard** (vervangt het Admin Hub): To do (gereden races zonder uitslag, met knop "Add results"), seizoensvoortgang per divisie, laatst ingevoerd (View / Edit / Copy link), komende races (→ kalender bewerken), data-check (mogelijk dubbele coureurs, races zonder YouTube-link, oude races zonder uitslag) en snelle acties.
- Edit Season opent via `?season=…&division=…`.
- **Add Track en Edit Track vernieuwd** (nieuwe stijl): alle velden (GP-naam, circuit, land met vlag-controle, landcode, bochten, lengte) en **layout-afbeelding uploaden** (slepen, kiezen of plakken met Ctrl+V; voorbeeld vooraf; verwijderen). Edit Track: zoekbare lijst met vlaggen, 🖼 = eigen afbeelding, opent via `?track=…`.
- Circuitpagina toont de geüploade layout-afbeelding; zonder upload valt hij terug op de ingebouwde afbeeldingen.
- **Add Season en Edit Season in de nieuwe stijl**: donkere kaarten, nette tabel, labels bij de velden, gewijzigde races geel gemarkeerd, meldingen in de pagina in plaats van browser-pop-ups.

### Opgelost
- De opmaak van Edit Season zette kleurvariabelen voor de hele site (licht thema); daardoor had o.a. de kampioenschapspagina de verkeerde tekstkleur. De opmaak geldt nu alleen nog voor de seizoenspagina's.

### Verbeterd
- Google: gestructureerde gegevens (naam "STB Racing League", logo, YouTube/Twitch/TikTok/Discord), zodat Google de juiste sitenaam toont in plaats van "Vercel".
- Vierkante favicons (48/192 px + Apple-icoon); Google toonde het oude, niet-vierkante favicon niet.
- **Circuitpagina in de nieuwe stijl** (zoals de coureurspagina): grote kop met vlag en layout-afbeelding, statistiek-tegels (lengte, bochten, verreden races, verschillende winnaars, meeste overwinningen), races als kaarten met podium-badges; alle teksten in de 5 talen; datums in de gekozen taal.
- Homepage-kop noemt de volledige naam: "… STB Racing League".
- Google Search Console-verificatiebestand toegevoegd.

## [2.3.0] – 2026-11-25

### Nieuw
- **Coureurspagina vernieuwd**: kop in de nieuwe stijl (vlag, naam, huidig team, actief sinds, titels, geclaimd door), 12 carrièretegels (o.a. titels, win %, beste finish), laatste race met podium en eigen resultaat, recente races, **tabel per seizoen** met team en eindpositie, start-vs-finish-heatmap, resultatenverdeling, puntenfinishes en een **vorm-grafiek** (laatste 10 races, vaste schaal P1–P20).
- "Coureur niet gevonden"-pagina met links terug.

### Verbeterd
- De pagina laadt ±15× minder data (eigen API-route) en gebruikt geen grafiekbibliotheek meer.
- Alles vertaald in 5 talen; datums volgen de gekozen taal.
- Land wijzigen via een knop "Wijzig land" bij de naam (alleen eigenaar/admin), met foutmelding in de pagina in plaats van een pop-up.

### Opgelost
- Heatmap klapte soms vanzelf dicht.
- "Geen punten" in de resultatenverdeling was groen; nu grijs.

## [2.2.0] – 2026-11-25

### Opgelost
- Socials- en taalmenu: "Open ↗" viel buiten het menu.

### Gewijzigd
- Taalkeuze toont vlaggen (afbeeldingen) in plaats van "GB"/"NL" — Windows kan geen vlag-emoji tonen.

### Nieuw
- Drie nieuwe talen: **Duits**, **Turks** en **Spaans** (alle 156 teksten vertaald; bestanden in `src/locales/de|tr|es/common.json`).

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
