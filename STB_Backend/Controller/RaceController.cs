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
        var tracks  = _context.Tracks
            .ToList();

        if (!tracks.Any())
        return NotFound(new { message = "No tracks were found." });

        return Ok(tracks );
    }

    [HttpGet("races")]
    public IActionResult GetAllRaces()
    {
        var races  = _context.Races
            .Include(r => r.Track)
            .ToList();

        if (!races.Any())
        return NotFound(new { message = "No races were found." });

        foreach(var race in races){
            var track = _context.Tracks.FirstOrDefault(t => t.Id == race.Track.Id);
            race.Track = track;
        }

        return Ok(races );
    }

    [HttpGet("races/{season}")]
    public IActionResult GetRacesBySeason(int season)
    {
        var races  = _context.Races
            .Where(r => r.Season == season)
            .ToList();

        if (!races.Any())
        return NotFound(new { message = "No races were found." });

        foreach(var race in races){
            var track = _context.Tracks.FirstOrDefault(t => t.Id == race.Id);
            race.Track = track;
        }

        return Ok(races );
    }

    [HttpGet("race/{id}")]
    public IActionResult GetRacesById(int id)
    {
        var race  = _context.Races
            .Where(r => r.Id == id)
            .Include(r => r.Track)
            .FirstOrDefault();

        if (race is null)
        return NotFound(new { message = "No races were found." });

        return Ok(race );
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

        var race  = _context.Races
            .Where(r => r.Season == season && r.Division == division && r.Round == round && r.Sprint == Type)
            .Include(r => r.Track)
            .FirstAsync();

        if (race == null){
            return NotFound(new { message = "No races were found." });
        }

        return Ok(race );
    }

    [HttpGet("results/{raceId}")]
    public IActionResult GetRaceResults(int raceId)
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

            if(!string.IsNullOrWhiteSpace(result.Driver)){

                var existingDriver = await _context.Drivers.FirstOrDefaultAsync(d => d.Name == result.Driver);

                if (existingDriver == null)
                {
                    existingDriver = new Driver
                    {
                        Country = null,
                        Name = result.Driver,
                        UserId = null
                    };

                    _context.Drivers.Add(existingDriver);
                    await _context.SaveChangesAsync();
                }  

                if (result.DNF == "Yes")
                {
                    result.Points = 0;
                }

                if (result.FastestLap)
                {
                    var FastestLap = new FastestLap
                    {
                        RaceId = result.RaceId,
                        DriverId = _context.Drivers.Where(d => d.Name == result.Driver).Select(d => d.Id).FirstOrDefault(),
                        Race = await _context.Races.FindAsync(result.RaceId),
                        Driver = _context.Drivers.Where(d => d.Name == result.Driver).FirstOrDefault(),
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
    [HttpGet("{id}")]
    public async Task<ActionResult<RaceResult>> GetRaceResultById(int id)
    {
        var raceResult = await _context.RaceResults.FindAsync(id);
        if (raceResult == null)
        {
            return NotFound();
        }

        return Ok(raceResult);
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

        var Race = new Race{
            F1_Game = race.Game,
            Season = race.Season,
            Division = race.Division,
            Round = race.Round,
            Sprint = race.Sprint,
            Track = existingTrack,
            YoutubeLink = race.YoutubeLink
        };
        
        // Voeg de race toe en sla op
        _context.Races.Add(Race);
        await _context.SaveChangesAsync();

        return Ok(new { message = $"{race.Round} added successfully!" });
    }

    [HttpPut("update/{id}")]
    public async Task<IActionResult> UpdateRace(int id, [FromBody] Race updatedRace)
    {
        var race = await _context.Races.Include(r => r.Track).FirstOrDefaultAsync(r => r.Id == id);

        if (race == null)
            return NotFound("Race not found.");

        race.F1_Game = updatedRace.F1_Game;
        race.Season = updatedRace.Season;
        race.Division = updatedRace.Division;
        race.Round = updatedRace.Round;
        race.Sprint = updatedRace.Sprint;
        race.YoutubeLink = updatedRace.YoutubeLink;

        // Update track details
        if (updatedRace.Track != null)
        {
            race.Track.Name = updatedRace.Track.Name;
            race.Track.Country = updatedRace.Track.Country;
        }

        await _context.SaveChangesAsync();
        return Ok("Race updated successfully.");
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

}

public class RaceRequest{
    public int Id { get; set; }
    public int Game { get; set; }
    public int Season { get; set; }
    public int Division { get; set; }
    public int Round { get; set; }
    public string Sprint { get; set; }
    public int TrackId { get; set; }
    public string YoutubeLink { get; set; }
}

public class RaceResultRequest{
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