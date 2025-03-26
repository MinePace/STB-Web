using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Text.Json;
using System.Xml.Schema;


[Route("api/fastestlap")]
[ApiController]
public class FastestlapController : ControllerBase
{
    private readonly DataContext _context;

    public FastestlapController(DataContext context)
    {
        _context = context;
    }

    [HttpGet("{season}/{division}")]
    public IActionResult GetFastestlaps(int season, int division)
    {
        var fastestlaps  = _context.FastestLaps
            .Where(f => f.Race.Season == season)
            .Where(f => f.Race.Division == division)
            .Include(f => f.Driver)
            .ToList();

        if (fastestlaps == null)
        return NotFound(new { message = "No Fastestlaps were found." });

        return Ok(fastestlaps);
    }

    [HttpGet()]
    public IActionResult GetAllFastestlaps()
    {
        var fastestlaps  = _context.FastestLaps
            .Include(f => f.Driver)
            .ToList();

        if (fastestlaps == null)
        return NotFound(new { message = "No Fastestlaps were found." });

        return Ok(fastestlaps);
    }
}