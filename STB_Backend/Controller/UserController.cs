using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Text.Json;


[Route("api/user")]
[ApiController]
public class UserController : ControllerBase
{
    private readonly DataContext _context;

    public UserController(DataContext context)
    {
        _context = context;
    }

    [HttpGet("{name}")]
    public IActionResult GetUser(string name)
    {
        var driver  = _context.Users
            .Where(d => d.Username == name)
            .FirstOrDefault();

        if (driver == null)
        return NotFound(new { message = "No User was found with this username." });

        return Ok(driver);
    }

    [HttpPut("update/{id}")]
    public IActionResult UpdateUser(int id, [FromBody] UserRequest userDTO)
    {
        var user = _context.Users.FirstOrDefault(u => u.Id == id);
        if (user == null)
            return NotFound(new { message = "User not found" });

        user.Username = userDTO.Username;
        user.Email = userDTO.Email;
        user.Role = userDTO.Role;
        user.DriverClaimed = userDTO.DriverClaimed;

        _context.SaveChanges();

        return Ok(user);
    }

    public class UserRequest
    {
        public int Id { get; set; }
        public string Username { get; set; }
        public string Email { get; set; }
        public string Role { get; set; }
        public bool DriverClaimed { get; set; }
    }
}