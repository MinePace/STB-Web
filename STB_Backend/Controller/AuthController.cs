using Microsoft.AspNetCore.Mvc;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

[Route("api/auth")]
[ApiController]
public class AuthController : ControllerBase
{
    private readonly DataContext _context;

    public AuthController(DataContext context)
    {
        _context = context;
    }

    // 🔹 Login endpoint
    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginRequest request)
    {
        var user = _context.Users.FirstOrDefault(u => u.Username == request.Username);
        if (user == null || user.PasswordHash != HashPassword(request.Password))
        {
            Console.WriteLine(HashPassword(request.Password));
            return Unauthorized(new { message = "Invalid username or password" });
        }

        user.LoginCount++; // Verhoog login teller
        _context.SaveChanges();

        return Ok(new { message = "Login successful", loginCount = user.LoginCount, role = user.Role, name = user.Username });
    }

    // 🔹 Register endpoint
    [HttpPost("register")]
    public IActionResult Register([FromBody] RegisterRequest request)
    {
        if (_context.Users.Any(u => u.Username == request.Username))
        {
            return BadRequest(new { message = "Username already exists" });
        }

        if (_context.Users.Any(u => u.Email == request.Email))
        {
            return BadRequest(new { message = "Email already in use" });
        }

        var newUser = new User
        {
            Username = request.Username,
            PasswordHash = HashPassword(request.Password),
            Email = request.Email,
            LoginCount = 1 // Eerste keer ingelogd
        };

        _context.Users.Add(newUser);
        _context.SaveChanges();

        return Ok(new { message = "Registration successful", loginCount = 1 });
    }

    [HttpPost("upload-result")]
    public async Task<IActionResult> UploadRaceResult(
        [FromForm] int season,
        [FromForm] int tier,
        [FromForm] int round,
        [FromForm] IFormFile file,
        [FromForm] string country,
        [FromForm] string circuit)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded.");

        var savePath = Path.Combine("..", "STB_Frontend", "public", "results", $"season{season}", $"tier{tier}", "race-results");
        if (!Directory.Exists(savePath))
            Directory.CreateDirectory(savePath);

        var filePath = Path.Combine(savePath, $"round{round}.png");

        using (var stream = new FileStream(filePath, FileMode.Create))
            await file.CopyToAsync(stream);

        Console.WriteLine($"✅ Uploaded race result image for Tier {tier}, Round {round}");
        Console.WriteLine($"📡 Attempting to notify bot...");

        // ✅ Notify the Discord bot
        try
        {
            using var client = new HttpClient();
            var botUrl = "http://localhost:3000/api/notify-new-result";
            var payload = new
            {
                season,
                tier,
                round,
                imagePath = $"/results/season{season}/tier{tier}/race-results/round{round}.png",
                isFinal = false,
                country,
                circuit
            };

            var json = JsonSerializer.Serialize(payload);
            Console.WriteLine($"📦 Sending payload: {json}");

            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await client.PostAsync(botUrl, content);
            var responseText = await response.Content.ReadAsStringAsync();

            Console.WriteLine($"[BOT_NOTIFY] Sent POST to {botUrl} (Tier {tier}, Round {round})");
            Console.WriteLine($"[BOT_NOTIFY] Response: {response.StatusCode} → {responseText}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[WARN] Could not notify bot: {ex.Message}");
        }

        return Ok(new { message = "Upload successful", path = filePath });
    }

    [HttpPost("upload-championship")]
    public async Task<IActionResult> UploadChampionshipImage(
        [FromForm] int season,
        [FromForm] int tier,
        [FromForm] string mode,   // "drivers" or "constructors"
        [FromForm] string country,
        [FromForm] string circuit,
        [FromForm] IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded.");

        // Folder path
        var savePath = Path.Combine("..", "STB_Frontend", "public", "results", $"season{season}", $"tier{tier}");
        if (!Directory.Exists(savePath))
            Directory.CreateDirectory(savePath);

        string fileName = mode switch
        {
            "drivers" => "championship-drivers.png",
            "constructors" => "championship-constructors.png",
            _ => "championship.png"
        };

        var filePath = Path.Combine(savePath, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
            await file.CopyToAsync(stream);

        Console.WriteLine($"🏆 Uploaded championship image ({mode}) → {filePath}");

        // 🔵 Optional: Notify your Discord bot
        try
        {
            using var client = new HttpClient();
            var botUrl = "http://localhost:3000/api/notify-championship";

            var payload = new
            {
                season,
                tier,
                mode,
                country,
                circuit,
                imagePath = $"/results/season{season}/tier{tier}/{fileName}"
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync(botUrl, content);
            var responseText = await response.Content.ReadAsStringAsync();

            Console.WriteLine($"[BOT_NOTIFY_CHAMP] Response: {response.StatusCode} → {responseText}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[WARN] Could not notify bot (championship): {ex.Message}");
        }

        return Ok(new { message = "Championship upload successful", path = filePath });
    }

    // 🔹 Wachtwoord hash functie
    private string HashPassword(string password)
    {
        using var sha256 = SHA256.Create();
        var hashedBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
        return Convert.ToBase64String(hashedBytes);
    }
}

// 🔹 Login en Register Request modellen
public class LoginRequest
{
    public string Username { get; set; }
    public string Password { get; set; }
}

public class RegisterRequest
{
    public string Username { get; set; }
    public string Password { get; set; }
    public string Email { get; set; }
}
