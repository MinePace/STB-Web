using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using System.Xml.Schema;


[Route("api/raceresult")]
[ApiController]
public class RaceResultController : ControllerBase
{
    private readonly DataContext _context;

    public RaceResultController(DataContext context)
    {
        _context = context;
    }

    [HttpGet("{id}")]
    public IActionResult GetResults(int id)
    {
        var results = _context.RaceResults
            .Where(d => d.RaceId == id)
            .ToListAsync();

        if (results == null)
            return NotFound(new { message = "No results were found with this raceId." });

        return Ok(results);
    }

    public record RaceStepDto(
        int RaceId, int Round, string Name, bool Sprint, DateTime? Date,
        IReadOnlyList<StandingDto> Standings);

    public record StandingDto(
        int Rank, string Driver, int? TeamId, int PointsThisRace, int Cumulative);

    [HttpGet("seasonprogress/{season:int}/{division:int}/race-points")]
    public async Task<IActionResult> SeasonProgress(
        int season, int division,
        [FromQuery] bool aggregateByRound = false)
    {
        // 1) Pull races + results for this season/division
        var races = await _context.Races
            .Include(r => r.Track)
            .Include(r => r.RaceResults)
            .Where(r => r.Season == season && r.Division == division)
            .Select(r => new {
                r.Id,
                r.Season,
                r.Division,
                r.Round,
                Name = r.Track.RaceName,
                Sprint = r.Sprint,  // <-- this is probably a string in your DB ("Yes"/"No")
                r.Date,
                Results = r.RaceResults.Select(res => new {
                    res.Driver,
                    res.TeamId,
                    res.Points
                })
            })
            .ToListAsync();

        if (races.Count == 0)
            return NotFound(new { message = "No results were found with these parameters." });

        // 2) Convert "Yes"/"No" sprint field to bool
        //    and build tuple collection
        IEnumerable<(int RaceId, int Round, string Name, bool Sprint, DateTime? Date,
                    IEnumerable<(string Driver, int? TeamId, decimal Points)> Results)> steps;

        if (!aggregateByRound)
        {
            steps = races
                .OrderBy(r => r.Round)
                .ThenBy(r => r.Sprint)
                .Select(r =>
                (
                    RaceId: r.Id,
                    Round: r.Round,
                    Name: r.Name,
                    Sprint: string.Equals(r.Sprint, "Yes", StringComparison.OrdinalIgnoreCase),
                    Date: r.Date,
                    Results: r.Results.Select(x => (x.Driver, (int?)x.TeamId, x.Points))
                ));
        }
        else
        {
            steps = races
                .GroupBy(r => r.Round)
                .OrderBy(g => g.Key)
                .Select(g =>
                {
                    var header = g.OrderBy(r => r.Sprint).First();
                    var merged = g.SelectMany(r => r.Results)
                                .GroupBy(x => new { x.Driver, x.TeamId })
                                .Select(x => (x.Key.Driver, (int?)x.Key.TeamId, Points: x.Sum(z => z.Points)));
                    return (
                        RaceId: header.Id,
                        Round: header.Round,
                        Name: header.Name,
                        Sprint: false,
                        Date: header.Date,
                        Results: merged
                    );
                });
        }

        // 3) Build cumulative standings
        var cumulative = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        var outSteps = new List<object>();

        foreach (var s in steps)
        {
            // add points from this step
            foreach (var (driver, _, pts) in s.Results)
            {
                cumulative[driver] = cumulative.GetValueOrDefault(driver) + pts;
            }

            // top 15 cumulative
            var standings = cumulative
                .OrderByDescending(kv => kv.Value)
                .ThenBy(kv => kv.Key)
                .Select((kv, i) => new {
                    Rank = i + 1,
                    Driver = kv.Key,
                    TeamId = s.Results.FirstOrDefault(r => 
                        string.Equals(r.Driver, kv.Key, StringComparison.OrdinalIgnoreCase)).TeamId,
                    PointsThisRace = s.Results.Where(r => 
                        string.Equals(r.Driver, kv.Key, StringComparison.OrdinalIgnoreCase)).Sum(r => r.Points),
                    Cumulative = kv.Value
                })
                .ToList();

            outSteps.Add(new {
                RaceId = s.RaceId,
                Round = s.Round,
                RaceName = s.Name,
                Sprint = s.Sprint,
                Date = s.Date,
                Standings = standings
            });
        }

        return Ok(outSteps);
    }

    [HttpPut("update/{id}")]
    public IActionResult UpdateResult(int id, [FromBody] RaceResultDTO newResult)
    {
        var result = _context.RaceResults.FirstOrDefault(r => r.Id == id);

        if (result == null)
            return NotFound(new { message = "No results were found with this raceId." });

        if(newResult.DNF == "Yes"){
            newResult.Points = 0;
        }

        // ✅ Ensure correct data types & update entity properties
        result.Position = newResult.Position;
        result.Driver = newResult.Driver;
        result.Points = newResult.Points;
        result.Team = newResult.Team;
        result.TeamId = newResult.TeamId;
        result.DNF = newResult.DNF; // Ensure DNF is stored as string or change model to bool
        result.Qualifying = newResult.Qualifying;
        result.Pos_Change = newResult.Pos_Change;
        result.Time = newResult.Time;
        result.Penalty = newResult.Penalty;

        try
        {
            _context.SaveChanges(); // ✅ Save changes explicitly
            return Ok(new { message = "Race result updated successfully", updatedResult = result });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while updating the race result.", error = ex.Message });
        }
    }

    [HttpDelete("delete/{id}")]
    public IActionResult DeleteResult(int id)
    {
        var results  = _context.RaceResults
            .Where(d => d.Id == id)
            .FirstOrDefault();

        if (results == null)
        return NotFound(new { message = "No results were found with this Id." });

        _context.RaceResults.Remove(results);
        _context.SaveChanges();

        return Ok(new { message = "Results succesfully deleted." });
    }


    public class RaceResultDTO
    {
        public int Position { get; set; }
        public string Driver { get; set; }
        public string Team { get; set; }
        public int TeamId { get; set; }
        public decimal Points { get; set; }
        public string DNF { get; set; }
        public int Qualifying { get; set; }
        public int Pos_Change { get; set; }
        public string? Time { get; set; }
        public int? Penalty { get; set; }
    }
}