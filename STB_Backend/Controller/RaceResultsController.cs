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
        var results  = _context.RaceResults
            .Where(d => d.RaceId == id)
            .ToListAsync();

        if (results == null)
        return NotFound(new { message = "No results were found with this raceId." });

        return Ok(results);
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
        public int Points { get; set; }
        public string DNF { get; set; }
        public int Qualifying { get; set; }
        public int Pos_Change { get; set; }
        public string? Time { get; set; }
    }
}