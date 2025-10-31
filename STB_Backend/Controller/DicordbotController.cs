using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using System.Xml.Schema;


[Route("api/discordbot")]
[ApiController]
public class DiscordbotController : ControllerBase
{
    private readonly DataContext _context;

    public DiscordbotController(DataContext context)
    {
        _context = context;
    }

    [HttpGet("driver-stats-by-discord/{discordId}")]
    public async Task<IActionResult> GetDriverStatsByDiscord(string discordId)
    {
        var driver = await _context.Drivers.FirstOrDefaultAsync(d => d.DiscordId == discordId);
        if (driver == null)
            return NotFound(new { message = "No driver linked with this Discord ID." });

        // Reuse your existing stats logic:
        return GetDriverStats(driver.Name);
    }

    [HttpGet("driver-stats/{driverName}")]
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
        var averageQualifying = driverResults.Average(r => r.Qualifying);
        var races = driverResults.Count();
        var dnfs = driverResults.Count(r => r.DNF == "DNF" || r.DNF == "Yes");

        var fastestLaps = _context.FastestLaps.Include(fl => fl.Driver).Count(fl => fl.Driver.Name == driverName);

        var lastRace = _context.Races
            .Where(r => r.RaceResults.Any(rr => rr.Driver == driverName))
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
            .FirstOrDefault();

        var allRaces = _context.Races
            .Where(r => r.RaceResults.Any(rr => rr.Driver == driverName))
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

    [HttpGet("tier-info/{tier}")]
    public IActionResult GetTierInfo(int tier)
    {
        // 1️⃣ Get latest season automatically
        var latestSeason = _context.Races.Max(r => r.Season);

        // 2️⃣ Get all races in that season and tier
        var races = _context.Races
            .Where(r => r.Season == latestSeason && r.Division == tier)
            .Include(r => r.RaceResults)
            .AsNoTracking()
            .ToList();

        if (!races.Any())
            return NotFound(new { message = $"No data found for tier {tier} in season {latestSeason}" });

        // 3️⃣ Get latest completed race (one that has RaceResults)
        var latestRace = _context.Races
            .Include(r => r.Track)
            .Where(r => r.Season == latestSeason && r.Division == tier)
            .Where(r => _context.RaceResults.Any(rr => rr.RaceId == r.Id)) // ✅ ensure results exist
            .OrderByDescending(r => r.Round)
            .Select(r => new
            {
                r.Id,
                r.Round,
                r.YoutubeLink,
                TrackName = r.Track != null ? r.Track.RaceName : "Unknown Track"
            })
            .FirstOrDefault();

        // 4️⃣ Next scheduled race (no results yet, round higher than latest)
        var nextRaceQuery = _context.Races
            .Include(r => r.Track)
            .Where(r => r.Season == latestSeason && r.Division == tier);

        if (latestRace != null)
        {
            nextRaceQuery = nextRaceQuery.Where(r => r.Round > latestRace.Round);
        }

        var nextRace = nextRaceQuery
            .OrderBy(r => r.Round)
            .Select(r => new
            {
                r.Id,
                r.Round,
                r.Date,
                r.YoutubeLink,
                TrackName = r.Track != null ? r.Track.RaceName : "Unknown Track"
            })
            .FirstOrDefault();

        // 5️⃣ Calculate total points per driver
        var championship = races
            .SelectMany(r => r.RaceResults)
            .GroupBy(rr => rr.Driver)
            .Select(g => new
            {
                Driver = g.Key,
                Points = g.Sum(rr => rr.Points)
            })
            .OrderByDescending(x => x.Points)
            .ToList();

        // 6️⃣ Calculate total points per team (Constructors)
        var constructors = races
            .SelectMany(r => r.RaceResults)
            .Where(rr => !string.IsNullOrEmpty(rr.Team))
            .GroupBy(rr => rr.Team)
            .Select(g => new
            {
                Team = g.Key,
                Points = g.Sum(rr => rr.Points)
            })
            .OrderByDescending(x => x.Points)
            .Take(3) // Only top 3
            .ToList();

        // 7️⃣ Get team and driver info for this tier/season
        var teams = _context.Teams
            .Select(t => new
            {
                name = t.Name,
                drivers = _context.SeasonalTeamDrivers
                    .Where(std => std.TeamId == t.Id && std.Season == latestSeason && std.Division == tier)
                    .Include(std => std.Driver)
                    .Select(std => new
                    {
                        name = std.Driver.Name,
                        discordId = std.Driver.DiscordId,
                        country = std.Driver.Country
                    })
                    .ToList()
            })
            .Where(t => t.drivers.Any())
            .ToList();

        // Build response
        var response = new
        {
            tier,
            season = latestSeason,
            races = races.Count,
            latestRace = latestRace != null ? new
            {
                name = latestRace.TrackName,
                round = latestRace.Round,
                link = latestRace.YoutubeLink
            } : null,
            nextRace = nextRace != null ? new
            {
                name = nextRace.TrackName,
                round = nextRace.Round,
                date = nextRace.Date,
                link = nextRace.YoutubeLink
            } : null,
            championship = championship.Take(3), // 🏆 Top 3 Drivers
            constructors, // 🏎️ Top 3 Teams
            teams
        };

        return Ok(response);
    }

    [HttpGet("fulltime-drivers/{season}/{tier}")]
    public IActionResult GetFulltimeDrivers(int season, int tier)
    {
        // Pull all drivers registered for this season & tier
        var drivers = _context.SeasonalTeamDrivers
            .Include(std => std.Driver)
            .Include(std => std.Team)
            .Where(std => std.Season == season && std.Division == tier)
            .Select(std => new
            {
                driver = std.Driver.Name,
                team = std.Team.Name
            })
            .OrderBy(d => d.team)
            .ThenBy(d => d.driver)
            .ToList();

        if (!drivers.Any())
            return NotFound(new { message = $"No drivers found for season {season}, tier {tier}" });

        // Optional: count unique drivers per team
        var teams = _context.Teams
            .Select(t => new
            {
                name = t.Name,
                drivers = _context.SeasonalTeamDrivers
                    .Where(std => std.TeamId == t.Id && std.Season == season && std.Division == tier)
                    .Include(std => std.Driver)
                    .Select(std => new
                    {
                        name = std.Driver.Name,
                        discordId = std.Driver.DiscordId,
                        country = std.Driver.Country
                    })
                    .ToList()
            })
            .Where(t => t.drivers.Any())
            .ToList();

        return Ok(new
        {
            season,
            tier,
            totalDrivers = drivers.Count,
            teams
        });
    }

    [HttpGet("next-race/{tier}")]
    public IActionResult GetNextRace(int tier)
    {
        var latestSeason = _context.Races.Max(r => r.Season);

        var nextRace = _context.Races
            .Where(r => r.Season == latestSeason && r.Division == tier)
            .OrderBy(r => r.Date)
            .FirstOrDefault();

        if (nextRace == null)
            return NotFound(new { message = "No upcoming race found" });

        return Ok(new
        {
            tier,
            nextRace.Round,
            nextRace.Date
        });
    }

    [HttpGet("get-race/{tier}/{round}")]
    public IActionResult GetCurrentSeasonRace(int tier, int round)
    {
        var latestSeason = _context.Races.Max(r => r.Season);

        var race = _context.Races
            .Where(r => r.Season == latestSeason && r.Division == tier && r.Round == round)
            .OrderBy(r => r.Date)
            .FirstOrDefault();

        if (race == null)
            return NotFound(new { message = "No upcoming race found" });

        return Ok(new
        {
            tier,
            race.Round,
            race.Date
        });
    }
}