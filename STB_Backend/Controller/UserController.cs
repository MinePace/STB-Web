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
}