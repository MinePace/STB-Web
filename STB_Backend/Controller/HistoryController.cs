using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using System.Xml.Schema;


[Route("api/history")]
[ApiController]
public class HistoryController : ControllerBase
{
    private readonly DataContext _context;

    public HistoryController(DataContext context)
    {
        _context = context;
    }

    [HttpGet("champions")]
    public async Task<IActionResult> GetHistory()
    {
        // Load all races with their results. NoTracking for speed.
        var races = await _context.Races
            .Include(r => r.RaceResults)
            .ThenInclude(rr => rr.Driver)
            .Include(r => r.RaceResults)
            .ThenInclude(rr => rr.Team)
            .AsNoTracking()
            .ToListAsync();

        if (races.Count == 0)
            return Ok(Array.Empty<SeasonChampionsDto>());

        var result = races
            .GroupBy(r => r.Season)
            .OrderBy(g => g.Key)
            .Select(seasonGroup => new SeasonChampionsDto
            {
                Season = seasonGroup.Key,
                Winners = seasonGroup
                    .GroupBy(r => r.Division)
                    .OrderBy(g => g.Key)
                    .Select(divGroup =>
                    {
                        // A division/season is "finished" only if EVERY race has >= 1 result
                        bool finished = divGroup.All(r =>
                            r.RaceResults != null && r.RaceResults.Any());

                        if (!finished)
                        {
                            return new WinnerDto
                            {
                                Division = divGroup.Key,
                                Finished = false,
                                Message = "Season has not yet finished"
                            };
                        }

                        // Aggregate all results in this (season, division) per driver
                        // Adjust property names if your model differs
                        var driverAgg = divGroup
                            .SelectMany(r => r.RaceResults)
                            .GroupBy(rr => rr.Driver) // if you have DriverId use rr.DriverId instead
                            .Select(g => new
                            {
                                Driver = g.Key,                    // if Driver is nav: g.First().Driver.Name
                                Points = g.Sum(x => x.Points),         // adjust if your points field differs
                                Wins = g.Count(x => x.Position == 1)   // adjust if your win condition differs
                            })
                            .OrderByDescending(x => x.Points)
                            .ThenByDescending(x => x.Wins)
                            .ThenBy(x => x.Driver)
                            .FirstOrDefault();

                        if (driverAgg == null)
                        {
                            // No results at all (defensive fallback)
                            return new WinnerDto
                            {
                                Division = divGroup.Key,
                                Finished = false,
                                Message = "Season has not yet finished"
                            };
                        }

                        return new WinnerDto
                        {
                            Division = divGroup.Key,
                            Driver = driverAgg.Driver.Name,
                            Points = driverAgg.Points,
                            Wins = driverAgg.Wins,
                            Finished = true
                        };
                    })
                    .ToList()
            })
            .ToList();

        return Ok(result);
    }
}

public sealed class WinnerDto
{
    public int Division { get; set; }
    public string Driver { get; set; } = "";
    public decimal Points { get; set; }
    public int Wins { get; set; }
    public bool Finished { get; set; }
    public string? Message { get; set; } 
}

public sealed class SeasonChampionsDto
{
    public int Season { get; set; }
    public List<WinnerDto> Winners { get; set; } = new();
}
