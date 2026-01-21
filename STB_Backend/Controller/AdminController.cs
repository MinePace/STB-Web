using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Security.Cryptography;
using System.Text;


[Route("api/admin")]
[ApiController]
public class AdminController : ControllerBase
{
    private readonly DataContext _context;

    public AdminController(DataContext context)
    {
        _context = context;
    }

    [HttpPost("drivers/combine/{leadDriverId}")]
    public async Task<IActionResult> CombineDrivers(
        int leadDriverId,
        [FromBody] CombineDriversRequest request)
    {
        if (request.DriverIds == null || request.DriverIds.Count < 2)
            return BadRequest("At least two drivers are required.");

        if (!request.DriverIds.Contains(leadDriverId))
            return BadRequest("Lead driver must be included in driverIds.");

        // Load drivers
        var drivers = await _context.Drivers
            .Where(d => request.DriverIds.Contains(d.Id))
            .ToListAsync();

        if (drivers.Count != request.DriverIds.Count)
            return BadRequest("One or more drivers do not exist.");

        var leadDriver = drivers.First(d => d.Id == leadDriverId);
        var mergedDrivers = drivers.Where(d => d.Id != leadDriverId).ToList();

        using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            var mergedDriverIds = mergedDrivers.Select(d => d.Id).ToList();

            // 1️⃣ RaceResults
            await _context.RaceResults
                .Where(r => mergedDriverIds.Contains(r.DriverId))
                .ExecuteUpdateAsync(s =>
                    s.SetProperty(r => r.DriverId, leadDriverId));

            // 2️⃣ SeasonalTeamDrivers
            await _context.SeasonalTeamDrivers
                .Where(s => mergedDriverIds.Contains(s.DriverId))
                .ExecuteUpdateAsync(s =>
                    s.SetProperty(d => d.DriverId, leadDriverId));

            // 3️⃣ FastestLaps
            await _context.FastestLaps
                .Where(f => mergedDriverIds.Contains(f.DriverId))
                .ExecuteUpdateAsync(s =>
                    s.SetProperty(f => f.DriverId, leadDriverId));

            // 4️⃣ If drivers are linked to users → keep lead, unlink others
            foreach (var driver in mergedDrivers)
            {
                if (driver.UserId != null && leadDriver.UserId == null)
                {
                    leadDriver.UserId = driver.UserId;
                    leadDriver.User = driver.User;
                }
            }

            // 5️⃣ Delete merged drivers
            _context.Drivers.RemoveRange(mergedDrivers);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new
            {
                LeadDriver = leadDriver.Name,
                MergedDrivers = mergedDrivers.Select(d => d.Name)
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return StatusCode(500, ex.Message);
        }
    }
    public class CombineDriversRequest
    {
        public List<int> DriverIds { get; set; }
    }
}
