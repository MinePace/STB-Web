using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using System.Xml.Schema;


[Route("api/track")]
[ApiController]
public class TrackController : ControllerBase
{
    private readonly DataContext _context;

    public TrackController(DataContext context)
    {
        _context = context;
    }

    [HttpGet("{id}")]
    public IActionResult GetTrack(int id)
    {
        var track  = _context.Tracks
            .Where(d => d.Id == id)
            .FirstOrDefault();

        if (track == null)
        return NotFound(new { message = "No track were found with this Id." });

        return Ok(track);
    }

    [HttpGet()]
    public IActionResult GetAllTrack(int id)
    {
        var tracks  = _context.Tracks
            .ToListAsync();

        if (tracks == null)
        return NotFound(new { message = "No tracks were found." });

        return Ok(tracks);
    }

    [HttpPut("update/{id}")]
    public IActionResult UpdateTrack(int id, [FromBody] Track updatedTrack)
    {
        var track  = _context.Tracks
            .Where(d => d.Id == id)
            .FirstOrDefault();

        if (track == null)
        return NotFound(new { message = $"No track was found with this Id: {id}." });

        track.Name = updatedTrack.Name;
        track.RaceName = updatedTrack.RaceName;
        track.Country = updatedTrack.Country;

        _context.Tracks.Update(track);
        _context.SaveChanges();

        return Ok(track);
    }
}