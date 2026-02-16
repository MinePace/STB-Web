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

    [HttpPost("teamdrivers")]
    public async Task<IActionResult> AddTeamDrivers([FromBody] TeamDriverRequest request)
    {
        if (request == null)
            return BadRequest(new { message = "Invalid data." });

        if (request.TeamId <= 0)
            return BadRequest(new { message = "TeamId is required." });

        if (request.Season <= 0 || request.Division <= 0)
            return BadRequest(new { message = "Season and Division are required." });

        if (request.Drivers == null || !request.Drivers.Any())
            return BadRequest(new { message = "At least one driver is required." });

        if (request.Drivers.Count > 2)
            return BadRequest(new { message = "Maximum 2 drivers allowed per team." });

        // 1️⃣ Haal bestaande team-driver links op (voor wissel scenario)
        var existingLinks = await _context.SeasonalTeamDrivers
            .Where(td =>
                td.Season == request.Season &&
                td.Division == request.Division &&
                td.TeamId == request.TeamId)
            .ToListAsync();

        // 2️⃣ Verwijder oude links (team wisselt van rijder)
        if (existingLinks.Any())
        {
            _context.SeasonalTeamDrivers.RemoveRange(existingLinks);
        }

        var createdLinks = new List<SeasonalTeamDriver>();

        // 3️⃣ Loop door drivers
        foreach (var driverNameRaw in request.Drivers)
        {
            if (string.IsNullOrWhiteSpace(driverNameRaw))
                continue;

            var driverName = driverNameRaw.Trim();
            var normalized = driverName.ToLower();

            // Zoek bestaande driver
            var existingDriver = await _context.Drivers
                .FirstOrDefaultAsync(d => d.Name.ToLower() == normalized);

            // Maak driver als hij niet bestaat
            if (existingDriver == null)
            {
                existingDriver = new Driver
                {
                    Name = driverName,
                    Country = null,
                    UserId = null
                };

                _context.Drivers.Add(existingDriver);
                await _context.SaveChangesAsync();
            }

            // Maak nieuwe team-driver link
            var teamDriver = new SeasonalTeamDriver
            {
                Season = request.Season,
                Division = request.Division,
                TeamId = request.TeamId,
                DriverId = existingDriver.Id
            };

            _context.SeasonalTeamDrivers.Add(teamDriver);
            createdLinks.Add(teamDriver);
        }

        await _context.SaveChangesAsync();

        // Load navigation props
        foreach (var link in createdLinks)
        {
            await _context.Entry(link).Reference(t => t.Team).LoadAsync();
            await _context.Entry(link).Reference(t => t.Driver).LoadAsync();
        }

        return Ok(createdLinks);
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
        public List<string> Drivers { get; set; } = new();
    }
}