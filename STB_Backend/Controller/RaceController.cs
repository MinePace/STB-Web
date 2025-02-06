using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Text.Json;


[Route("api/[controller]")]
[ApiController]
public class RaceController : ControllerBase
{
    private readonly DataContext _context;

    public RaceController(DataContext context)
    {
        _context = context;
    }

    [HttpGet("championship/{season}/{division}")]
    public IActionResult GetChampionship(int season, int division)
    {
        var championshipResults  = _context.RaceResults
            .Where(r => r.Race.Season == season && r.Race.Division == division)
            .Include(r => r.Race)
            .Include(r => r.Race.Track)
            .OrderByDescending(r => r.Points)
            .ToList();

        if (!championshipResults.Any())
        return NotFound(new { message = "No results found for this division." });

        return Ok(championshipResults );
    }

    [HttpGet("championship-races/{season}/{division}")]
    public IActionResult GetChampionshipRaces(int season, int division)
    {
        var championshipRaces  = _context.Races
            .Where(r => r.Season == season && r.Division == division)
            .OrderBy(r => r.Id)
            
            .Include(r => r.Track)
            .ToList();

        if (!championshipRaces.Any())
        return NotFound(new { message = "No results found for this division." });

        return Ok(championshipRaces );
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
            .ToList();

        if (!races.Any())
        return NotFound(new { message = "No races were found." });

        foreach(var race in races){
            var track = _context.Tracks.FirstOrDefault(t => t.Id == race.Id);
            race.Track = track;
        }

        return Ok(races );
    }

    [HttpGet("driver/stats/{driverName}")]
    public IActionResult GetDriverStats(string driverName)
    {
        var driverResults = _context.RaceResults
            .Where(r => r.Driver == driverName)
            .ToList();

        if (!driverResults.Any())
            return NotFound(new { message = "Driver not found" });

        var totalPoints = driverResults.Sum(r => r.Points);
        var poles = driverResults.Count(r => r.Qualifying == 1);
        var wins = driverResults.Count(r => r.Position == 1);
        var podiums = driverResults.Count(r => r.Position <= 3);
        var averagePosition = driverResults.Average(r => r.Position);
        var races = driverResults.Count();

        var stats = new
        {
            driver = driverName,
            totalPoints,
            poles,
            wins,
            podiums,
            averagePosition,
            races
        };

        return Ok(stats);
    }

    [HttpGet("results/{season}/{round}/{division}/{type}")]
    public IActionResult GetRaceResults(int season, int round, int division, string type)
    {
        bool isSprint = type.ToLower() == "sprint"; // Controleer of het een Sprint Race is

        var raceResults = _context.RaceResults
            .Where(r => r.Race.Season == season && r.Race.Round == round && r.Race.Division == division && (isSprint ? r.Race.Sprint == "1" : r.Race.Sprint == "0" || r.Race.Sprint == "No"))
            .OrderBy(r => r.Position)
            .ToList();

        if (!raceResults.Any())
            return NotFound(new { message = "Race not found" });

        return Ok(raceResults);
    }

    [HttpPost("raceresults")]
    public async Task<IActionResult> AddRaceResults([FromBody] List<RaceResult> raceResults)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        if (raceResults == null || raceResults.Count == 0)
        {
            return BadRequest("The race results list cannot be empty.");
        }

        _context.RaceResults.AddRange(raceResults);
        await _context.SaveChangesAsync();

        return Ok(new { message = $"{raceResults.Count} race results added successfully!" });
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
            Name = race.Name,
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

        return Ok(new { message = $"{race.Name} added successfully!" });
    }

}

public class RaceRequest{
    public int Id { get; set; }
    public string Name { get; set; }
    public int Game { get; set; }
    public int Season { get; set; }
    public int Division { get; set; }
    public int Round { get; set; }
    public string Sprint { get; set; }
    public int TrackId { get; set; }
    public string YoutubeLink { get; set; }
}