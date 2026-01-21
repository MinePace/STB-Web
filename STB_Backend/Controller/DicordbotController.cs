using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR.Protocol;
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
            .Include(r => r.Driver)
            .Include(r => r.Team)
            .Where(r => r.Driver.Name == driverName)
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
            .Where(r => r.RaceResults.Any(rr => rr.Driver.Name == driverName))
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
            .ThenInclude(rr => rr.Driver)
            .Include(r => r.RaceResults)
            .ThenInclude(rr => rr.Team)
            .AsNoTracking()
            .ToList();

        if (!races.Any())
            return NotFound(new { message = $"No data found for tier {tier} in season {latestSeason}" });

        var drivers = _context.Races
            .Where(r => r.Season == latestSeason && r.Division == tier)
            .SelectMany(r => r.RaceResults.Select(rr => new{
                rr.Driver.Name,
                rr.Driver.DiscordId
            }))
            .Distinct()
            .ToList();

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
            .GroupBy(rr => rr.Driver.Name)
            .Select(g => new
            {
                Driver = g.Key,
                DiscordId = _context.Drivers
                    .Where(d => d.Name == g.Key)
                    .Select(d => d.DiscordId)
                    .FirstOrDefault(),
                Points = g.Sum(rr => (decimal)rr.Points)
            })
            .OrderByDescending(x => x.Points)
            .ToList();

        // 6️⃣ Calculate total points per team (Constructors)
        var constructors = races
            .SelectMany(r => r.RaceResults)
            .Where(rr => !string.IsNullOrEmpty(rr.Team.Name))
            .GroupBy(rr => rr.Team.Name)
            .Select(g => new
            {
                Team = g.Key,
                Points = g.Sum(rr => (decimal)rr.Points)
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
            drivers,
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

    [HttpGet("hall-of-fame")]
    public async Task<IActionResult> GetHallofFame()
    {
        // Load all races with their results
        var races = await _context.Races
            .Include(r => r.RaceResults)
            .ThenInclude(rr => rr.Driver)
            .Include(r => r.RaceResults)
            .ThenInclude(rr => rr.Team)
            .AsNoTracking()
            .ToListAsync();

        if (races.Count == 0)
            return Ok(Array.Empty<object>());

        // 🧩 Load all drivers once (for name-to-DiscordId lookup)
        var drivers = await _context.Drivers
            .Select(d => new { d.Name, d.DiscordId })
            .ToListAsync();

        var result = races
            .GroupBy(r => r.Season)
            .OrderBy(g => g.Key)
            .Select(seasonGroup =>
            {
                var season = seasonGroup.Key;

                var winners = seasonGroup
                    .GroupBy(r => r.Division)
                    .OrderBy(g => g.Key)
                    .Select(divGroup =>
                    {
                        // ✅ Only include divisions where *every race* has results
                        bool finished = divGroup.All(r => r.RaceResults != null && r.RaceResults.Any());
                        if (!finished)
                            return null;

                        // 🧮 Aggregate all driver stats for this season/division
                        var driverAgg = divGroup
                            .SelectMany(r => r.RaceResults)
                            .Where(rr => !string.IsNullOrEmpty(rr.Driver.Name))
                            .GroupBy(rr => rr.Driver)
                            .Select(g => new
                            {
                                Driver = g.Key,
                                Points = g.Sum(x => x.Points),
                                Wins = g.Count(x => x.Position == 1)
                            })
                            .OrderByDescending(x => x.Points)
                            .ThenByDescending(x => x.Wins)
                            .ThenBy(x => x.Driver.Name)
                            .FirstOrDefault();

                        if (driverAgg == null)
                            return null;

                        // 🧭 Try to find DiscordId by driver name (case-insensitive)
                        var discordId = drivers
                            .FirstOrDefault(d => d.Name.ToLower() == driverAgg.Driver.Name.ToLower())
                            ?.DiscordId;

                        return new
                        {
                            Division = divGroup.Key,
                            Driver = driverAgg.Driver.Name,
                            DiscordId = discordId,
                            Points = driverAgg.Points,
                            Wins = driverAgg.Wins,
                            Finished = true
                        };
                    })
                    .Where(w => w != null)
                    .ToList();

                if (!winners.Any())
                    return null;

                return new
                {
                    Season = season,
                    Winners = winners
                };
            })
            .Where(s => s != null)
            .ToList();

        return Ok(result);
    }

    [HttpGet("history-stats")]
    public async Task<IActionResult> GetHistoryStats()
    {
        var allResults = await _context.RaceResults
            .Include(r => r.Driver)
            .Include(r => r.Team)
            .AsNoTracking()
            .ToListAsync();

        if (!allResults.Any())
            return Ok(new { message = "No race results found." });

        var drivers = await _context.Drivers
            .Select(d => new { d.Name, d.DiscordId })
            .ToListAsync();

        Func<Driver, string?> getDiscordId = (driver) =>
            drivers.FirstOrDefault(d => d.Name.ToLower() == driver.Name.ToLower())?.DiscordId;

        // 🏆 Top 10 by Wins
        var topWins = allResults
            .Where(r => r.Position == 1)
            .GroupBy(r => new { r.DriverId, r.Driver.Name })
            .Select(g => new
            {
                Driver = g.Key,
                Wins = g.Count(),
                DiscordId = drivers
                    .FirstOrDefault(d => d.Name.ToLower() == g.Key.Name.ToLower())
                    ?.DiscordId
            })
            .OrderByDescending(x => x.Wins)
            .Take(10)
            .ToList();

        // 🥈 Top 10 by Podiums
        var topPodiums = allResults
            .Where(r => r.Position >= 1 && r.Position <= 3)
            .GroupBy(r => new { r.DriverId, r.Driver.Name })
            .Select(g => new
            {
                Driver = g.Key,
                Podiums = g.Count(),
                DiscordId = drivers
                    .FirstOrDefault(d => d.Name.ToLower() == g.Key.Name.ToLower())
                    ?.DiscordId
            })
            .OrderByDescending(x => x.Podiums)
            .Take(10)
            .ToList();

        // 💯 Top 10 by Total Points
        var topPoints = allResults
            .GroupBy(r => new { r.DriverId, r.Driver.Name })
            .Select(g => new
            {
                Driver = g.Key,
                Points = g.Sum(r => r.Points),
                DiscordId = drivers
                    .FirstOrDefault(d => d.Name.ToLower() == g.Key.Name.ToLower())
                    ?.DiscordId
            })
            .OrderByDescending(x => x.Points)
            .Take(10)
            .ToList();

        // 🎯 Top 10 by Poles
        var topPoles = allResults
            .Where(r => r.Qualifying == 1)
            .GroupBy(r => new { r.DriverId, r.Driver.Name })
            .Select(g => new
            {
                Driver = g.Key,
                Poles = g.Count(),
                DiscordId = drivers
                    .FirstOrDefault(d => d.Name.ToLower() == g.Key.Name.ToLower())
                    ?.DiscordId
            })
            .OrderByDescending(x => x.Poles)
            .Take(10)
            .ToList();

        // 🏁 Average Finish (≥15 races)
        var avgFinish = allResults
            .GroupBy(r => new { r.DriverId, r.Driver.Name })
            .Where(g => g.Count() >= 15)
            .Select(g => new
            {
                Driver = g.Key,
                AvgFinish = Math.Round(g.Average(r => r.Position), 2),
                Races = g.Count(),
                DiscordId = drivers
                    .FirstOrDefault(d => d.Name.ToLower() == g.Key.Name.ToLower())
                    ?.DiscordId
            })
            .OrderBy(x => x.AvgFinish)
            .ThenByDescending(x => x.Races)
            .Take(10)
            .ToList();

        // 🎯 Average Qualifying (≥15 races)
        var avgQualifying = allResults
            .Where(r => r.Qualifying > 0) // ignore missing data
            .GroupBy(r => new { r.DriverId, r.Driver.Name })
            .Where(g => g.Count() >= 15)
            .Select(g => new
            {
                Driver = g.Key,
                AvgQuali = Math.Round(g.Average(r => r.Qualifying), 2),
                Races = g.Count(),
                DiscordId = drivers
                    .FirstOrDefault(d => d.Name.ToLower() == g.Key.Name.ToLower())
                    ?.DiscordId
            })
            .OrderBy(x => x.AvgQuali)
            .ThenByDescending(x => x.Races)
            .Take(10)
            .ToList();

        var result = new
        {
            generatedAt = DateTime.UtcNow,
            totalRaces = allResults.Select(r => r.RaceId).Distinct().Count(),
            totalDrivers = drivers.Count,
            filters = new { minRacesForAverages = 15 },
            topWins,
            topPodiums,
            topPoints,
            topPoles,
            avgFinish,
            avgQualifying
        };

        return Ok(result);
    }

    [HttpGet("history-stats/{division}")]
    public async Task<IActionResult> GetHistoryStatsByDivision(int division)
    {
        // Load race results only for this division
        var allResults = await _context.RaceResults
            .Include(r => r.Race)
            .Include(r => r.Driver)
            .Include(r => r.Team)
            .Where(r => r.Race.Division == division)
            .AsNoTracking()
            .ToListAsync();

        if (!allResults.Any())
            return Ok(new { message = $"No race results found for Division {division}." });

        var drivers = await _context.Drivers
            .Select(d => new { d.Name, d.DiscordId })
            .ToListAsync();

        Func<Driver, string?> getDiscordId = (driver) =>
            drivers.FirstOrDefault(d => d.Name.ToLower() == driver.Name.ToLower())?.DiscordId;

        // 🏆 Top 10 by Wins
        var topWins = allResults
            .Where(r => r.Position == 1)
            .GroupBy(r => new { r.DriverId, r.Driver.Name })
            .Select(g => new
            {
                Driver = g.Key,
                Wins = g.Count(),
                DiscordId = drivers
                    .FirstOrDefault(d => d.Name.ToLower() == g.Key.Name.ToLower())
                    ?.DiscordId
            })
            .OrderByDescending(x => x.Wins)
            .Take(10)
            .ToList();

        // 🥈 Top 10 by Podiums
        var topPodiums = allResults
            .Where(r => r.Position >= 1 && r.Position <= 3)
            .GroupBy(r => new { r.DriverId, r.Driver.Name })
            .Select(g => new
            {
                Driver = g.Key,
                Podiums = g.Count(),
                DiscordId = drivers
                    .FirstOrDefault(d => d.Name.ToLower() == g.Key.Name.ToLower())
                    ?.DiscordId
            })
            .OrderByDescending(x => x.Podiums)
            .Take(10)
            .ToList();

        // 💯 Top 10 by Points
        var topPoints = allResults
            .GroupBy(r => new { r.DriverId, r.Driver.Name })
            .Select(g => new
            {
                Driver = g.Key,
                Points = g.Sum(r => r.Points),
                DiscordId = drivers
                    .FirstOrDefault(d => d.Name.ToLower() == g.Key.Name.ToLower())
                    ?.DiscordId
            })
            .OrderByDescending(x => x.Points)
            .Take(10)
            .ToList();

        // 🎯 Top 10 by Poles
        var topPoles = allResults
            .Where(r => r.Qualifying == 1)
            .GroupBy(r => new { r.DriverId, r.Driver.Name })
            .Select(g => new
            {
                Driver = g.Key,
                Poles = g.Count(),
                DiscordId = drivers
                    .FirstOrDefault(d => d.Name.ToLower() == g.Key.Name.ToLower())
                    ?.DiscordId
            })
            .OrderByDescending(x => x.Poles)
            .Take(10)
            .ToList();

        // 🏁 Average Finish (≥15 races)
        var avgFinish = allResults
            .GroupBy(r => new { r.DriverId, r.Driver.Name })
            .Where(g => g.Count() >= 15)
            .Select(g => new
            {
                Driver = g.Key,
                AvgFinish = Math.Round(g.Average(r => r.Position), 2),
                Races = g.Count(),
                DiscordId = drivers
                    .FirstOrDefault(d => d.Name.ToLower() == g.Key.Name.ToLower())
                    ?.DiscordId
            })
            .OrderBy(x => x.AvgFinish)
            .ThenByDescending(x => x.Races)
            .Take(10)
            .ToList();

        // 🎯 Average Qualifying (≥15 races)
        var avgQualifying = allResults
            .Where(r => r.Qualifying > 0)
            .GroupBy(r => new { r.DriverId, r.Driver.Name })
            .Where(g => g.Count() >= 15)
            .Select(g => new
            {
                Driver = g.Key,
                AvgQuali = Math.Round(g.Average(r => r.Qualifying), 2),
                Races = g.Count(),
                DiscordId = drivers
                    .FirstOrDefault(d => d.Name.ToLower() == g.Key.Name.ToLower())
                    ?.DiscordId
            })
            .OrderBy(x => x.AvgQuali)
            .ThenByDescending(x => x.Races)
            .Take(10)
            .ToList();

        var result = new
        {
            division,
            generatedAt = DateTime.UtcNow,
            totalRaces = allResults.Select(r => r.RaceId).Distinct().Count(),
            totalDrivers = drivers.Count,
            filters = new { minRacesForAverages = 15 },
            topWins,
            topPodiums,
            topPoints,
            topPoles,
            avgFinish,
            avgQualifying
        };

        return Ok(result);
    }

    [HttpPut("name-change/{discordId}")]
    public async Task<IActionResult> ChangeDriverName(string discordId, string name)
    {
        var driver = await _context.Drivers.FirstOrDefaultAsync(d => d.DiscordId == discordId);
        if (driver == null)
            return NotFound(new { message = "Driver not found for the provided Discord ID." });

        var oldName = driver.Name;

        driver.Name = name;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Driver name updated successfully.", driver, oldName });
    }

    [HttpPut("name-change-driver/{drivername}")]
    public async Task<IActionResult> ChangeDriverNameByName(string drivername, string name)
    {
        var driver = await _context.Drivers.FirstOrDefaultAsync(d => d.Name == drivername);
        if (driver == null)
            return NotFound(new { message = "Driver not found for the provided Discord ID." });

        var oldName = driver.Name;

        driver.Name = name;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Driver name updated successfully.", driver, oldName });
    }
}