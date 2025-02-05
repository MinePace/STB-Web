using Microsoft.AspNetCore.Mvc;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

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

        return Ok(new { message = "Login successful", loginCount = user.LoginCount, role = user.Role });
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
