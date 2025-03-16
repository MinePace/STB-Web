using Microsoft.AspNetCore.Mvc;
using System.Linq;
using System.Security.Cryptography;
using System.Text;


[Route("api/admin")]
[ApiController]
public class AdminController : ControllerBase
{
    private readonly DataContext _context;

    public AdminController(DataContext context)
    {
        _context = context;
    }

    [HttpPost("upload")]
    public async Task<IActionResult> UploadCsv(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("Bestand is leeg");

        try
        {
            using (var stream = new StreamReader(file.OpenReadStream()))
            {
                string headerLine = await stream.ReadLineAsync(); // Skip header line
                while (!stream.EndOfStream)
                {
                    var line = await stream.ReadLineAsync();
                    var fields = line.Split(',');

                    // CSV waarden uitlezen en trimmen
                    int f1Game = int.Parse(fields[0].Trim());
                    int season = int.Parse(fields[1].Trim());
                    int division = int.Parse(fields[2].Trim());
                    int round = int.Parse(fields[3].Trim());
                    string sprint = string.IsNullOrEmpty(fields[4].Trim()) ? "No" : "Yes";
                    string country = fields[5].Trim();
                    string trackName = fields[6].Trim();
                    string raceName = fields[7].Trim();
                    int position = int.Parse(fields[8].Trim());
                    string driver = fields[9].Trim();
                    string team = fields[10].Trim();
                    int points = int.Parse(fields[11].Trim());
                    string dnf = string.IsNullOrEmpty(fields[12].Trim()) ? "No" : fields[12].Trim();
                    int posChange = int.Parse(fields[13].Trim());
                    int qualifying = int.Parse(fields[14].Trim());

                    // 1. Controleer of de Track al bestaat
                    var track = _context.Tracks.FirstOrDefault(t => t.Name == trackName && t.Country == country);
                    if (track == null)
                    {
                        track = new Track { Name = trackName, Country = country };
                        _context.Tracks.Add(track);
                        await _context.SaveChangesAsync();
                    }

                    // 2. Controleer of de Race al bestaat
                    var race = _context.Races.FirstOrDefault(r =>
                        r.F1_Game == f1Game &&
                        r.Season == season &&
                        r.Division == division &&
                        r.Round == round &&
                        r.Sprint == sprint &&
                        r.Track.Id == track.Id);

                    if (race == null)
                    {
                        race = new Race
                        {
                            F1_Game = f1Game,
                            Season = season,
                            Division = division,
                            Round = round,
                            Sprint = sprint,
                            Track = track
                        };
                        _context.Races.Add(race);
                        await _context.SaveChangesAsync();
                    }

                    // 3. Voeg het RaceResult toe
                    var raceResult = new RaceResult
                    {
                        RaceId = race.Id,
                        Race = race,
                        Position = position,
                        Driver = driver,
                        Team = team,
                        Points = points,
                        DNF = dnf,
                        Pos_Change = posChange,
                        Qualifying = qualifying
                    };

                    _context.RaceResults.Add(raceResult);
                }

                await _context.SaveChangesAsync();
            }

            return Ok("CSV data succesvol overgezet naar de database!");
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Interne serverfout: {ex.Message}");
        }
    }
}
