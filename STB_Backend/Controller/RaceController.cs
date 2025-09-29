using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Query;
using System.Linq;
using System.Text.Json;


[Route("api/race")]
[ApiController]
public class RaceController : ControllerBase
{
    private readonly DataContext _context;

    public RaceController(DataContext context)
    {
        _context = context;
    }

    [HttpGet("tracks")]
    public IActionResult GetAllTracks()
    {
        var tracks = _context.Tracks
            .ToList();

        if (!tracks.Any())
            return NotFound(new { message = "No tracks were found." });

        return Ok(tracks);
    }

    [HttpGet("races")]
    public IActionResult GetAllRaces()
    {
        var races = _context.Races
            .Include(r => r.Track)
            .ToList();

        if (!races.Any())
            return NotFound(new { message = "No races were found." });

        foreach (var race in races)
        {
            var track = _context.Tracks.FirstOrDefault(t => t.Id == race.Track.Id);
            race.Track = track;
        }

        return Ok(races);
    }

    [HttpGet("races/{season}")]
    public IActionResult GetRacesBySeason(int season)
    {
        var races = _context.Races
            .Where(r => r.Season == season)
            .ToList();

        if (!races.Any())
            return NotFound(new { message = "No races were found." });

        foreach (var race in races)
        {
            var track = _context.Tracks.FirstOrDefault(t => t.Id == race.Id);
            race.Track = track;
        }

        return Ok(races);
    }

    [HttpGet("race/{id}")]
    public IActionResult GetRacesById(int id)
    {
        var race = _context.Races
            .Where(r => r.Id == id)
            .Include(r => r.Track)
            .Include(r => r.RaceResults.OrderBy(rr => rr.Position))
            .FirstOrDefault();

        var fastestLap = _context.FastestLaps
            .Where(fl => fl.RaceId == id)
            .Include(fl => fl.Driver)
            .FirstOrDefault();

        if (race is null)
            return NotFound(new { message = "No races were found." });

        return Ok(new { race, fastestLap });
    }

    [HttpGet("seasons")]
    public async Task<IActionResult> GetUniqueSeasons()
    {
        try
        {
            // Haal alle unieke seizoenen op uit de tabel Races
            var seasons = await _context.Races
                .Select(r => r.Season)
                .Distinct()
                .OrderBy(season => season)
                .ToListAsync();

            return Ok(seasons); // Stuur de unieke seizoenen terug als een lijst
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Interne serverfout: {ex.Message}");
        }
    }


    [HttpGet("race/{season}/{division}/{round}/{type}")]
    public IActionResult GetRace(int season, int division, int round, string type)
    {
        var Type = "No";
        bool isSprint = string.Equals(type.ToLower(), "sprint"); // Controleer of het een Sprint
        if (isSprint)
        {
            Type = "Yes";
        }

        var race = _context.Races
            .Where(r => r.Season == season && r.Division == division && r.Round == round && r.Sprint == Type)
            .Include(r => r.Track)
            .FirstAsync();

        if (race == null)
        {
            return NotFound(new { message = "No races were found." });
        }

        return Ok(race);
    }

    [HttpGet("results/{raceId}")]
    public IActionResult GetRaceResults(int raceId)
    {
        var raceResults = _context.Races
            .Where(r => r.Id == raceId)
            .Include(r => r.RaceResults)
            .ToList();

        if (!raceResults.Any())
            return NotFound(new { message = "Race not found" });

        return Ok(raceResults);
    }

    [HttpPost("raceresults")]
    public async Task<IActionResult> AddRaceResults([FromBody] List<RaceResultRequest> raceResults)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }
        if (raceResults == null || raceResults.Count == 0)
        {
            return BadRequest("The race results list cannot be empty.");
        }
        int count = 0;
        foreach (var result in raceResults)
        {
            if (!string.IsNullOrWhiteSpace(result.Driver))
            {
                var existingDriver = await _context.Drivers
                .FirstOrDefaultAsync(d => d.Name == result.Driver);
                if (existingDriver == null)
                {
                    existingDriver = new Driver { Country = null, Name = result.Driver, UserId = null };
                    _context.Drivers.Add(existingDriver);
                    await _context.SaveChangesAsync();
                }
                if (result.DNF == "Yes")
                { result.Points = 0; }
                if (result.FastestLap)
                {
                    var FastestLap = new FastestLap
                    {
                        RaceId = result.RaceId,
                        DriverId = _context.Drivers
                        .Where(d => d.Name == result.Driver)
                        .Select(d => d.Id)
                        .FirstOrDefault(),
                        Race = await _context.Races.FindAsync(result.RaceId),
                        Driver = _context.Drivers
                        .Where(d => d.Name == result.Driver)
                        .FirstOrDefault(),
                    };
                    _context.FastestLaps.AddRange(FastestLap);
                    await _context.SaveChangesAsync();
                }
                var NewResult = new RaceResult
                {
                    RaceId = result.RaceId,
                    Race = await _context.Races.FindAsync(result.RaceId),
                    Position = result.Position,
                    Driver = result.Driver,
                    Team = result.Team,
                    Points = result.Points,
                    DNF = result.DNF,
                    Pos_Change = result.Pos_Change,
                    Qualifying = result.Qualifying,
                    Time = result.Time
                };
                _context.RaceResults.AddRange(NewResult);
                await _context.SaveChangesAsync();
                count++;
            }
        }
        return Ok(new { message = $"{count} race results added successfully!" });
    }

    // 🔹 GET: api/raceresults/{id} (optioneel)
    [HttpGet("{id:int}")]
    public async Task<ActionResult<RaceResult>> GetRaceResultById(int id)
    {
        var raceResult = await _context.RaceResults.FindAsync(id);
        if (raceResult == null)
        {
            return NotFound();
        }

        return Ok(raceResult);
    }

    [HttpGet("latest")]
    public IActionResult GetLatestRace()
    {
        // Get latest race including track and race results
        var latestRace = _context.Races
            .Include(r => r.Track)
            .Include(r => r.RaceResults.OrderBy(rr => rr.Position))
            .Where(r => r.RaceResults.Any()) // 👈 only races with results
            .OrderByDescending(r => r.Season)
            .ThenByDescending(r => r.Round)
            .FirstOrDefault();

        if (latestRace == null)
            return NotFound(new { message = "Race not found" });

        // Shape the response
        var response = new
        {
            Race = new
            {
                latestRace.Id,
                latestRace.Season,
                latestRace.Division,
                latestRace.Round,
                latestRace.Sprint,
                Track = new
                {
                    latestRace.Track.Id,
                    latestRace.Track.Name,
                    latestRace.Track.Country
                },
                latestRace.YoutubeLink
            },
            Results = latestRace.RaceResults.Select(rr => new
            {
                rr.Position,
                rr.Driver,
                rr.Team,
                rr.Points,
                rr.Time,
                rr.DNF,
                rr.Qualifying,
                rr.Pos_Change
            }).ToList()
        };

        return Ok(response);
    }

    [HttpPost("track")]
    public async Task<IActionResult> AddTrack([FromBody] Track track)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        if (track == null)
        {
            return BadRequest("The track cannot be empty.");
        }

        _context.Tracks.Add(track);
        await _context.SaveChangesAsync();

        return Ok(new { message = $"{track.Name} added successfully!" });
    }

    [HttpPost()]
    public async Task<IActionResult> AddRace([FromBody] RaceRequest race)
    {
        Console.WriteLine($"Received Race: {JsonSerializer.Serialize(race)}");

        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        if (race == null)
        {
            return BadRequest("The race cannot be empty.");
        }

        // Zoek de bestaande track in de database en koppel deze
        var existingTrack = await _context.Tracks
            .FirstOrDefaultAsync(t => t.Id == race.TrackId);

        if (existingTrack == null)
        {
            return BadRequest("Track not found.");
        }

        var Race = new Race
        {
            F1_Game = race.Game,
            Season = race.Season,
            Division = race.Division,
            Round = race.Round,
            Sprint = race.Sprint,
            Track = existingTrack,
            YoutubeLink = race.YoutubeLink,
            Date = race.Date
        };

        // Voeg de race toe en sla op
        _context.Races.Add(Race);
        await _context.SaveChangesAsync();

        return Ok(new { message = $"{race.Round} added successfully!" });
    }

    [HttpPut("update/{id}")]
    public async Task<IActionResult> UpdateRace(int id, [FromBody] Race updatedRace)
    {
        var race = await _context.Races
            .FirstOrDefaultAsync(r => r.Id == id);  // no Include here

        if (race == null)
            return NotFound("Race not found.");

        race.F1_Game = updatedRace.F1_Game;
        race.Season = updatedRace.Season;
        race.Division = updatedRace.Division;
        race.Round = updatedRace.Round;
        race.Sprint = updatedRace.Sprint;
        race.YoutubeLink = updatedRace.YoutubeLink;
        race.Date = updatedRace.Date;

        // Prefer TrackId if provided; otherwise use Track?.Id from the payload
        var newTrackId = updatedRace.TrackId != 0
            ? updatedRace.TrackId
            : (updatedRace.Track?.Id ?? race.TrackId);

        race.TrackId = newTrackId;

        // IMPORTANT: do NOT set race.Track = null
        // Also make sure EF doesn't try to modify Track
        _context.Entry(race).Reference(r => r.Track).IsModified = false;

        await _context.SaveChangesAsync();
        return Ok("Race updated successfully.");
    }

    [HttpDelete("delete/{id}")]
    public async Task<IActionResult> DeleteRace(int id)
    {
        var race = await _context.Races.Include(r => r.Track).FirstOrDefaultAsync(r => r.Id == id);

        if (race == null)
            return NotFound("Race not found.");

        _context.Races.Remove(race);
        await _context.SaveChangesAsync();

        return Ok("Race deleted successfully.");
    }

    // 🔹 GET: api/race/raceresults
    [HttpGet("raceresults")]
    public async Task<ActionResult<RaceResult>> GetAllRaceResults()
    {
        var raceResult = await _context.RaceResults.ToListAsync();
        if (raceResult == null)
        {
            return NotFound();
        }

        return Ok(raceResult);
    }

    [HttpGet("stats/league")]
    public IActionResult GetLeagueStats()
    {
        var totalSeasons = _context.Races
            .Select(r => r.Season)
            .Distinct()
            .Count();

        var totalRaces = _context.Races.Count();

        var totalDrivers = _context.Drivers.Count();

        // Driver with most wins (Position == 1)
        var mostWins = _context.RaceResults
            .Where(rr => rr.Position == 1)
            .GroupBy(rr => rr.Driver)
            .Select(g => new
            {
                Driver = g.Key,
                Wins = g.Count()
            })
            .OrderByDescending(g => g.Wins)
            .FirstOrDefault();

        // Driver with most race participations
        var mostRaces = _context.RaceResults
            .GroupBy(rr => rr.Driver)
            .Select(g => new
            {
                Driver = g.Key,
                Races = g.Count()
            })
            .OrderByDescending(g => g.Races)
            .FirstOrDefault();

        var leagueStats = new
        {
            TotalSeasons = totalSeasons,
            TotalRaces = totalRaces,
            TotalDrivers = totalDrivers,
            MostWins = mostWins != null ? new { mostWins.Driver, mostWins.Wins } : null,
            MostRaces = mostRaces != null ? new { mostRaces.Driver, mostRaces.Races } : null
        };

        if (totalSeasons == 0 && totalRaces == 0 && totalDrivers == 0)
            return NotFound(new { message = "No league stats found." });

        return Ok(leagueStats);
    }

    [HttpGet("stats/season/{season}")]
    public IActionResult GetSeasonStats(int season)
    {
        var totalRaces = _context.Races
            .Where(r => r.Season == season)
            .Count();

        var racesCompleted = _context.Races
            .Include(r => r.RaceResults)
            .Where(r => r.Season == season)
            .Where(r => r.RaceResults.Any())
            .OrderByDescending(r => r.Round)
            .Count();

        var mostPodium = _context.RaceResults
            .Include(rr => rr.Race)
            .Where(rr =>
                    (rr.Position == 1 || rr.Position == 2 || rr.Position == 3)
                    && rr.Race.Season == season
                )
            .GroupBy(rr => rr.Driver)
            .Select(g => new
            {
                Driver = g.Key,
                Podium = g.Count()
            })
            .OrderByDescending(g => g.Podium)
            .FirstOrDefault();

        var seasonStats = new
        {
            TotalRaces = totalRaces,
            RacesCompleted = racesCompleted,
            MostPodium = mostPodium != null ? new { mostPodium.Driver, mostPodium.Podium } : null
        };

        if (totalRaces == 0 && racesCompleted == 0)
            return NotFound(new { message = "No season stats found." });

        return Ok(seasonStats);
    }

    [HttpGet("nextrace")]
    public IActionResult GetNextRace()
    {
        var nextRace = _context.Races
            .Include(r => r.Track)
            .Where(r => r.Date > DateTime.Now) // Filter
            .OrderBy(r => r.Date)
            .FirstOrDefault();
        if (nextRace == null)
            return NotFound(new { message = "No upcoming Races found." });
        // Shape the response
        return Ok(nextRace);
    }

    [HttpGet("test/{raceId}")]
    public IActionResult GetTest(int raceId)
    {
        var raceResults = _context.RaceResults
            .Where(r => r.Race.Id == raceId) // Ensure case-insensitivity
            .Include(r => r.Race)
            .OrderBy(r => r.Position)
            .ToList();

        if (!raceResults.Any())
            return NotFound(new { message = "Race not found" });

        return Ok(raceResults);
    }

    [HttpGet("testmail")]
    public async Task<IActionResult> TestMail()
    {
        try
        {
            await Mail.SendAsync(
                RaceId: 356,
                Location: "Montreal",
                recipientName: "Joey1854",
                recipientEmail: "joeyzwinkels@gmail.com",
                kind: RaceEmailKind.NewRaceResults,
                linkUrl: "http://localhost:5173/STB/Race/356"
            );

            return Ok("✅ Test mail sent successfully!");
        }
        catch (Exception ex)
        {
            // Log ex in real projects
            return StatusCode(500, $"❌ Failed to send mail: {ex.Message}");
        }
    }
}

public class RaceRequest
{
    public int Id { get; set; }
    public int Game { get; set; }
    public int Season { get; set; }
    public int Division { get; set; }
    public int Round { get; set; }
    public string Sprint { get; set; }
    public int TrackId { get; set; }
    public string? YoutubeLink { get; set; }
    public DateTime? Date { get; set; }
}

public class RaceResultRequest
{
    public int Id { get; set; }
    public int RaceId { get; set; }
    public int Position { get; set; }
    public string Driver { get; set; }
    public string Team { get; set; }
    public int Points { get; set; }
    public string DNF { get; set; }
    public int Pos_Change { get; set; }
    public int Qualifying { get; set; }
    public string? Time { get; set; }
    public bool FastestLap { get; set; }
}