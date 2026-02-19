using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Text.Json;
using System.Xml.Schema;


[Route("api/driver")]
[ApiController]
public class DriverController : ControllerBase
{
    private readonly DataContext _context;

    public DriverController(DataContext context)
    {
        _context = context;
    }

    [HttpGet("{name}")]
    public IActionResult GetDriverByName(string name)
    {
        var driver  = _context.Drivers
            .Where(d => d.Name == name)
            .Include(d => d.User)
            .FirstOrDefault();

        if (driver == null)
        return NotFound(new { message = "No driver was found with this name." });

        return Ok(driver);
    }

    [HttpGet("id/{id}")]
    public IActionResult GetDriverById(int id)
    {
        var driver  = _context.Drivers
            .Where(d => d.Id == id)
            .Include(d => d.User)
            .FirstOrDefault();

        if (driver == null)
        return NotFound(new { message = "No driver was found with this id." });

        return Ok(driver);
    }

    [HttpGet("user/{userName}")]
    public IActionResult GetDriverByUserId(string userName)
    {
        var driver  = _context.Drivers
            .Include(d => d.User)
            .Where(d => d.User.Username == userName)
            .FirstOrDefault();

        if (driver == null)
        return NotFound(new { message = "No driver was found with this userName." });

        return Ok(driver);
    }

    [HttpGet("stats/{driverName}")]
    public IActionResult GetDriverStats(string driverName)
    {
        var driverResults = _context.RaceResults
            .Where(r => r.Driver.Name == driverName)
            .Include(r => r.Driver)
            .Include(r => r.Team)
            .ToList();


        if (!driverResults.Any())
            return NotFound(new { message = "Driver not found" });

        var totalPoints = driverResults.Sum(r => r.Points);
        var poles = driverResults.Count(r => r.Qualifying == 1);
        var wins = driverResults.Count(r => r.Position == 1);
        var podiums = driverResults.Count(r => r.Position <= 3);
        var averagePosition = driverResults.Average(r => r.Position);
        var averageQualifying = driverResults.Average(r => r.Qualifying);
        var races = driverResults.Count();
        var dnfs = driverResults.Count(r => r.DNF == "DNF" || r.DNF == "Yes");

        var fastestLaps = _context.FastestLaps.Include(fl => fl.Driver).Count(fl => fl.Driver.Name == driverName);

        var lastRace = _context.Races
            .Where(r => r.RaceResults.Any(rr => rr.Driver.Name == driverName))
            .Include(r => r.RaceResults)
                .ThenInclude(rr => rr.Driver)
            .Include(r => r.RaceResults)
                .ThenInclude(rr => rr.Team)
            .OrderByDescending(r => r.Division)
            .ThenByDescending(r => r.Season)
            .ThenByDescending(r => r.Round)
            .Select(r => new {
                r.Id, r.F1_Game, r.Season, r.Division, r.Round, r.Sprint,
                r.Track, r.TrackId, r.Date, r.YoutubeLink,
                RaceResults = r.RaceResults.OrderBy(rr => rr.Position).ToList()
            })
            .AsNoTracking()
            .FirstOrDefault();

        var allRaces = _context.Races
            .Where(r => r.RaceResults.Any(rr => rr.Driver.Name == driverName))
            .Include(r => r.RaceResults)
                .ThenInclude(rr => rr.Driver)
            .Include(r => r.RaceResults)
                .ThenInclude(rr => rr.Team)
            .OrderByDescending(r => r.Division)
            .ThenByDescending(r => r.Season)
            .ThenByDescending(r => r.Round)
            .Select(r => new
            {
                r.Id,
                r.F1_Game,
                r.Season,
                r.Division,
                r.Round,
                r.Sprint,
                r.Track,
                r.TrackId,
                r.Date,
                r.YoutubeLink,
                RaceResults = r.RaceResults.OrderBy(rr => rr.Position).ToList()
            })
            .AsNoTracking()
            .ToList();

        var stats = new
        {
            driver = driverName,
            totalPoints,
            poles,
            wins,
            podiums,
            averagePosition,
            averageQualifying,
            races,
            fastestLaps,
            dnfs,
            lastRace,
            allRaces,
            driverOBJ = _context.Drivers.Where(d => d.Name == driverName).Include(d => d.User).FirstOrDefault()
        };

        return Ok(stats);
    }

    [HttpGet("season/{season}")]
    public IActionResult GetDriversBySeason(int season)
    {
        var driver  = _context.RaceResults
            .Where(d => d.Race.Season == season)
            .Where(d => d.Driver != null)
            .Select(d => d.Driver.Name) // Only get the driver names
            .Distinct()
            .ToList();

        if (driver == null)
        return NotFound(new { message = "No driver was found with this id." });

        return Ok(driver);
    }

    [HttpGet("all")]
    public IActionResult GetAllDrivers()
    {
        var driver  = _context.Drivers
            .ToList();

        if (driver == null)
        return NotFound(new { message = "No drivers were found." });

        return Ok(driver);
    }

    [HttpGet("claimeddriver/races/{username}")]
    public IActionResult GetClaimedDriverRaces(string username)
    {
        var user = _context.Users
            .FirstOrDefault(u => u.Username == username);

        if (user == null)
            return NotFound(new { message = "User not found." });

        var driver = _context.Drivers
            .FirstOrDefault(d => d.UserId == user.Id);

        if (driver == null)
            return NotFound(new { message = "No driver was found with this user id." });

        var appearances = _context.RaceResults
            .Where(rr => rr.Driver.Name == driver.Name)
            .Select(rr => new
            {
                Season = rr.Race.Season,
                Division = rr.Race.Division
            })
            .Distinct()
            .OrderByDescending(x => x.Season)
            .ThenBy(x => x.Division)
            .AsNoTracking()
            .ToList();

        return Ok(appearances);
    }

    [HttpPut("claim/{driverName}")]
    public IActionResult ClaimDriver(string driverName, [FromBody] ClaimDriverRequest request)
    {
        if (request == null || string.IsNullOrEmpty(request.Username))
            return BadRequest(new { message = "Username is required" });

        var driver = _context.Drivers.FirstOrDefault(d => d.Name == driverName);
        if (driver == null)
            return NotFound(new { message = "Driver not found" });

        var user = _context.Users.FirstOrDefault(u => u.Username == request.Username);
        if (user == null)
            return NotFound(new { message = "User not found" });

        driver.UserId = user.Id;
        driver.User = user;
        user.DriverClaimed = true;

        _context.Drivers.Update(driver);
        _context.Users.Update(user);

        _context.SaveChanges();

        return Ok(new { message = "Driver claimed", driver });
    }

    [HttpPut("update/{driverId}")]
    public IActionResult UpdateDriver(int driverId, [FromBody] DriverRequest request)
    {
        var driver = _context.Drivers.FirstOrDefault(d => d.Id == driverId);
        if (driver == null)
            return NotFound(new { message = "Driver not found" });

        driver.Country = request.Country;

        _context.Drivers.Update(driver);
        _context.SaveChanges();

        return Ok(new { message = "Driver Updated", driver });
    }

    [HttpPut("updateCountry/{driverId}")]
    public IActionResult UpdateDriverCountry(int driverId, [FromBody] CountryRequest request)
    {
        var driver = _context.Drivers.FirstOrDefault(d => d.Id == driverId);
        if (driver == null)
            return NotFound(new { message = "Driver not found" });

        driver.Country = request.Country;

        _context.Drivers.Update(driver);
        _context.SaveChanges();

        return Ok(new { message = "Driver Updated", driver });
    }

    [HttpPut("updateDiscord")]
    public async Task<IActionResult> UpdateDiscordIdByName([FromBody] UpdateDiscordDto dto)
    {
        var driver = await _context.Drivers
            .FirstOrDefaultAsync(d => d.Name.ToLower() == dto.DriverName.ToLower());

        if (driver == null)
            return NotFound(new { message = "Driver not found." });

        driver.DiscordId = dto.DiscordId;
        await _context.SaveChangesAsync();

        return Ok(new { message = $"Discord ID updated for {driver.Name}.", driver });
    }

    public class ClaimDriverRequest
    {
        public string Username { get; set; } // ✅ Define the username field correctly
    }

    public class DriverRequest
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string? Country { get; set; }
    }

    public class CountryRequest
    {
        public string Country { get; set; }
    }

    public class UpdateDiscordDto
    {
        public string DriverName { get; set; } = string.Empty;
        public string DiscordId { get; set; } = string.Empty;
    }
}