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
            .Where(r => r.Driver == driverName)
            .ToList();

        if (!driverResults.Any())
            return NotFound(new { message = "Driver not found" });

        var totalPoints = driverResults.Sum(r => r.Points);
        var poles = driverResults.Count(r => r.Qualifying == 1);
        var wins = driverResults.Count(r => r.Position == 1);
        var podiums = driverResults.Count(r => r.Position <= 3);
        var averagePosition = driverResults.Average(r => r.Position);
        var races = driverResults.Count();

        var stats = new
        {
            driver = driverName,
            totalPoints,
            poles,
            wins,
            podiums,
            averagePosition,
            races,
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
            .Select(d => d.Driver) // Only get the driver names
            .Distinct()
            .ToList();

        if (driver == null)
        return NotFound(new { message = "No driver was found with this id." });

        return Ok(driver);
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

    public class ClaimDriverRequest
    {
        public string Username { get; set; } // ✅ Define the username field correctly
    }

    public class DriverRequest
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string? Country { get; set; }
        public int? UserId { get; set; }
    }
}