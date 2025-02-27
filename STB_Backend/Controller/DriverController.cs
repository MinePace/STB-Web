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
    public IActionResult GetDriver(string name)
    {
        var driver  = _context.Drivers
            .Where(d => d.Name == name)
            .FirstOrDefaultAsync();

        if (driver == null)
        return NotFound(new { message = "No driver was found with this name." });

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
            driverOBJ = _context.Drivers.Where(d => d.Name == driverName).FirstOrDefault()
        };

        return Ok(stats);
    }

    [HttpPut("claim/{driverId}")]
    public IActionResult ClaimDriver(int driverId, [FromBody] ClaimDriverRequest request)
    {
        if (request == null || string.IsNullOrEmpty(request.Username))
            return BadRequest(new { message = "Username is required" });

        var driver = _context.Drivers.FirstOrDefault(d => d.Id == driverId);
        if (driver == null)
            return NotFound(new { message = "Driver not found" });

        var user = _context.Users.FirstOrDefault(u => u.Username == request.Username);
        if (user == null)
            return NotFound(new { message = "User not found" });

        driver.UserId = user.Id;
        driver.User = user;
        _context.Drivers.Update(driver);
        _context.SaveChanges();

        return Ok(new { message = "Driver claimed", driver });
    }

    public class ClaimDriverRequest
    {
        public string Username { get; set; } // ✅ Define the username field correctly
    }

}