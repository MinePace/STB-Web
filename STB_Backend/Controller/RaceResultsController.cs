using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Text.Json;
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
        var results  = _context.RaceResults
            .Where(d => d.RaceId == id)
            .ToListAsync();

        if (results == null)
        return NotFound(new { message = "No results were found with this raceId." });

        return Ok(results);
    }
}