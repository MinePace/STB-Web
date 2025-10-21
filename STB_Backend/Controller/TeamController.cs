using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using System.Xml.Schema;


[Route("api/team")]
[ApiController]
public class TeamController : ControllerBase
{
    private readonly DataContext _context;

    public TeamController(DataContext context)
    {
        _context = context;
    }

    [HttpGet()]
    public IActionResult GetAllTeams(int id)
    {
        var track = _context.Teams.OrderBy(t => t.Name).ToList();

        if (track == null)
            return NotFound(new { message = "No team was found with this Id." });

        return Ok(track);
    }


    [HttpGet("{id}")]
    public IActionResult GetTeam(int id)
    {
        var track = _context.Teams
            .Where(t => t.Id == id)
            .FirstOrDefault();

        if (track == null)
            return NotFound(new { message = "No team was found with this Id." });

        return Ok(track);
    }

    [HttpGet("color")]
    public IActionResult GetTeamColor([FromHeader]int season, int teamId)
    {
        var track = _context.SeasonalTeamColors
            .Where(t => t.TeamId == teamId && t.Season == season)
            .FirstOrDefault();

        if (track == null)
            return NotFound(new { message = "No team was found with this Id." });

        return Ok(track);
    }

    [HttpPost()]
    public IActionResult AddTeam([FromBody] Team newTeam)
    {
        if (newTeam == null)
            return BadRequest(new { message = "Invalid team data." });

        _context.Teams.Add(newTeam);
        _context.SaveChanges();

        return CreatedAtAction(nameof(GetTeam), new { id = newTeam.Id }, newTeam);
    }

    [HttpPost("teamcolor")]
    public IActionResult AddTeamColor([FromBody] SeasonalTeamColor newTeamColor)
    {
        if (newTeamColor == null)
            return BadRequest(new { message = "Invalid teamColor data." });

        _context.SeasonalTeamColors.Add(newTeamColor);
        _context.SaveChanges();

        return CreatedAtAction(nameof(GetTeam), new { id = newTeamColor.Id }, newTeamColor);
    }

    [HttpPost("teamdriver")]
    public IActionResult AddTeamDriver([FromBody] SeasonalTeamDriver newTeamDriver)
    {
        if (newTeamDriver == null)
            return BadRequest(new { message = "Invalid teamDriver data." });

        _context.SeasonalTeamDrivers.Add(newTeamDriver);
        _context.SaveChanges();

        return CreatedAtAction(nameof(GetTeam), new { id = newTeamDriver.Id }, newTeamDriver);
    }

    [HttpGet("teamdriver/{season}/{division}")]
    public IActionResult GetTeamDriver(int season, int division)
    {
        var TeamDrivers = _context.SeasonalTeamDrivers
            .Where(td => td.Season == season && td.Division == division)
            .Include(td => td.Team)
            .Include(td => td.Driver)
            .ToList();

        if (TeamDrivers == null)
            return BadRequest(new { message = "No TeamDriver data for this season." });

        return Ok(TeamDrivers);
    }

    [HttpPut("update/{id}")]
    public IActionResult UpdateTeam(int id, [FromBody] Team updatedTeam)
    {
        var team = _context.Teams
            .Where(t => t.Id == id)
            .FirstOrDefault();

        if (team == null)
            return NotFound(new { message = $"No team was found with this Id: {id}." });

        if (id != updatedTeam.Id)
            return BadRequest(new { message = "Team ID mismatch." });

        team.Name = updatedTeam.Name;
        team.Country = updatedTeam.Country;

        _context.Teams.Update(team);
        _context.SaveChanges();

        return Ok(team);
    }
}