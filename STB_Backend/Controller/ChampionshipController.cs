using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Text.Json;


[Route("api/championship")]
[ApiController]
public class ChampionshipController : ControllerBase
{
    private readonly DataContext _context;

    public ChampionshipController(DataContext context)
    {
        _context = context;
    }

    [HttpGet("{season}/{division}")]
    public IActionResult GetChampionship(int season, int division)
    {
        var championshipResults = _context.Races
            .Where(r => r.Season == season && r.Division == division)
            .Include(r => r.RaceResults)
            .Include(r => r.Track)
            .ToList();

        if (!championshipResults.Any())
            return NotFound(new { message = "No results found for this division." });

        return Ok(championshipResults);
    }

    [HttpGet("races/{season}/{division}")]
    public IActionResult GetChampionshipRaces(int season, int division)
    {
        var championshipRaces = _context.Races
            .Where(r => r.Season == season && r.Division == division)
            .OrderBy(r => r.Id)

            .Include(r => r.RaceResults)
            .Include(r => r.Track)
            .ToList();

        if (!championshipRaces.Any())
            return NotFound(new { message = "No results found for this division." });

        return Ok(championshipRaces);
    }

    [HttpGet("current")]
    public IActionResult GetCurrentChampionshipTop3()
    {
        var currentSeason = 29;

        // Aggregate totals
        var driverTotals = _context.RaceResults
            .Where(rr => rr.Race.Season == currentSeason)
            .GroupBy(rr => new { rr.Race.Division, rr.Driver })
            .Select(g => new
            {
                g.Key.Division,
                g.Key.Driver,
                TotalPoints = g.Sum(rr => rr.Points)
            })
            .ToList();

        // For each driver, also get his last team (latest race in that season)
        var lastTeams = _context.RaceResults
            .Where(rr => rr.Race.Season == currentSeason)
            .GroupBy(rr => new { rr.Race.Division, rr.Driver })
            .Select(g => new
            {
                g.Key.Division,
                g.Key.Driver,
                Team = g.OrderByDescending(x => x.Race.Round) // or x.Race.Date if you prefer
                            .Select(x => x.Team)
                            .FirstOrDefault()
            })
            .ToList();

        // Join totals with last team
        var withTeams = from total in driverTotals
                        join team in lastTeams
                        on new { total.Division, total.Driver }
                        equals new { team.Division, team.Driver }
                        select new
                        {
                            total.Division,
                            total.Driver,
                            total.TotalPoints,
                            team.Team
                        };

        // Now group by division and take top 3
        var perDivisionTop3 = withTeams
            .GroupBy(x => x.Division)
            .Select(g => new
            {
                Division = g.Key,
                Top3 = g.OrderByDescending(x => x.TotalPoints)
                        .ThenBy(x => x.Driver)
                        .Take(3)
                        .ToList()
            })
            .OrderBy(x => x.Division)
            .ToList();

        return Ok(perDivisionTop3);
    }
}