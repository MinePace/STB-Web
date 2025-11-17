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
        var track = _context.Tracks
            .Where(d => d.Id == id)
            .FirstOrDefault();

        if (track == null)
            return NotFound(new { message = "No track was found with this Id." });

        return Ok(track);
    }

    [HttpGet()]
    public IActionResult GetAllTrack()
    {
        var tracks = _context.Tracks
            .ToListAsync();

        if (tracks == null)
            return NotFound(new { message = "No tracks were found." });

        return Ok(tracks);
    }

    [HttpGet("races/{id}")]
    public IActionResult GetTrackRaces(int id)
    {
        var trackraces = _context.Races
            .Where(r => r.Track.Id == id)
            .Include(r => r.RaceResults)
                .ThenInclude(rr => rr.Driver)
            .Include(r => r.RaceResults)
                .ThenInclude(rr => rr.Team)
            .ToList();

        if (trackraces == null)
            return NotFound(new { message = "No track was found with this Id." });

        return Ok(trackraces);
    }

    [HttpPost()]
    public IActionResult CreateTrack([FromBody] Track newTrack)
    {
        if (newTrack == null)
            return BadRequest(new { message = "Invalid track data." });

        _context.Tracks.Add(newTrack);
        _context.SaveChanges();

        return CreatedAtAction(nameof(GetTrack), new { id = newTrack.Id }, newTrack);
    }

    [HttpPut("update/{id}")]
    public IActionResult UpdateTrack(int id, [FromBody] Track updatedTrack)
    {
        var track = _context.Tracks
            .Where(d => d.Id == id)
            .FirstOrDefault();

        if (track == null)
            return NotFound(new { message = $"No track was found with this Id: {id}." });

        if (id != updatedTrack.Id)
            return BadRequest(new { message = "Track ID mismatch." });

        track.Name = updatedTrack.Name;
        track.RaceName = updatedTrack.RaceName;
        track.Country = updatedTrack.Country;
        track.CountryCode = updatedTrack.CountryCode;
        track.Length = updatedTrack.Length;
        track.Turns = updatedTrack.Turns;

        _context.Tracks.Update(track);
        _context.SaveChanges();

        return Ok(track);
    }
    
    [HttpDelete("delete/{id}")]
    public async Task<IActionResult> DeleteTrack(int id)
    {
        var track = await _context.Tracks.FirstOrDefaultAsync(r => r.Id == id);

        if (track == null)
            return NotFound("Race not found.");

        _context.Tracks.Remove(track);
        await _context.SaveChangesAsync();

        return Ok("Track deleted successfully.");
    }
}