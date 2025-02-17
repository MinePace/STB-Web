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

    [HttpGet("races/{season}/{division}")]
    public IActionResult GetChampionshipRaces(int season, int division)
    {
        var championshipRaces = _context.Races
            .Where(r => r.Season == season && r.Division == division)
            .OrderBy(r => r.Id)
            
            .Include(r => r.Track)
            .ToList();

        if (!championshipRaces.Any())
        return NotFound(new { message = "No results found for this division." });

        return Ok(championshipRaces );
    }

}