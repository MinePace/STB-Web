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
    public async Task<IActionResult> AddTeamDriver([FromBody] TeamDriverRequest newTeamDriver)
    {
        if (newTeamDriver == null)
            return BadRequest(new { message = "Invalid teamDriver data." });

        if (newTeamDriver.TeamId <= 0)
            return BadRequest(new { message = "TeamId is required." });

        if (newTeamDriver.Season <= 0 || newTeamDriver.Division <= 0)
            return BadRequest(new { message = "Season and Division are required." });

        if (newTeamDriver.Driver == null || string.IsNullOrWhiteSpace(newTeamDriver.Driver))
            return BadRequest(new { message = "Driver name is required." });

        // 1️⃣ Check if driver already exists by name
        var driverName = newTeamDriver.Driver.Trim().ToLower();
        var existingDriver = await _context.Drivers
            .FirstOrDefaultAsync(d => d.Name.ToLower() == driverName);

        // 2️⃣ If not found, create the driver
        if (existingDriver == null)
        {
            existingDriver = new Driver
            {
                Name = newTeamDriver.Driver.Trim(),
                Country = null,
                UserId = null
            };

            _context.Drivers.Add(existingDriver);
            await _context.SaveChangesAsync();
        }

        // 3️⃣ Check if this team-driver-season-division combo already exists
        bool alreadyLinked = await _context.SeasonalTeamDrivers.AnyAsync(td =>
            td.Season == newTeamDriver.Season &&
            td.Division == newTeamDriver.Division &&
            td.TeamId == newTeamDriver.TeamId &&
            td.DriverId == existingDriver.Id);

        if (alreadyLinked)
        {
            Console.WriteLine($"Skipped duplicate: Team {newTeamDriver.TeamId}, Driver {existingDriver.Id}, Season {newTeamDriver.Season}, Division {newTeamDriver.Division}");
            return Ok(new { message = "Skipped existing TeamDriver link." });
        }


        // 4️⃣ Add the link
        var teamDriver = new SeasonalTeamDriver
        {
            Season = newTeamDriver.Season,
            Division = newTeamDriver.Division,
            TeamId = newTeamDriver.TeamId,
            DriverId = existingDriver.Id
        };

        _context.SeasonalTeamDrivers.Add(teamDriver);
        await _context.SaveChangesAsync();

        // Include team and driver objects in response
        await _context.Entry(teamDriver).Reference(t => t.Team).LoadAsync();
        await _context.Entry(teamDriver).Reference(t => t.Driver).LoadAsync();

        return CreatedAtAction(nameof(GetTeamDriver), new { season = teamDriver.Season, division = teamDriver.Division }, teamDriver);
    }

    [HttpGet("teamdriver/{season}/{division}")]
    public IActionResult GetTeamDriver(int season, int division)
    {
        var teamDrivers = _context.SeasonalTeamDrivers
            .Where(td => td.Season == season && td.Division == division)
            .Include(td => td.Team)
            .Include(td => td.Driver)
            .ToList();

        if (!teamDrivers.Any())
            return Ok(new List<object>());

        // ✅ Group drivers by team
        var grouped = teamDrivers
            .GroupBy(td => td.Team)
            .Select(g => new
            {
                teamId = g.Key.Id,
                teamName = g.Key.Name,
                season = season,
                division = division,
                drivers = g.Select(x => x.Driver.Name).ToList()
            })
            .OrderBy(x => x.teamName)
            .ToList();

        return Ok(grouped);
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

    public class TeamDriverRequest
    {
        public int Season { get; set; }
        public int Division { get; set; }
        public int TeamId { get; set; }
        public string Driver { get; set; }
    }
}