using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

public class DataContext : DbContext
{
    public DataContext(DbContextOptions<DataContext> options) : base(options) { }

    public DbSet<User> Users { get; set; }
    public DbSet<RaceResult> RaceResults { get; set; }
    public DbSet<Race> Races { get; set; }
    public DbSet<Track> Tracks { get; set; }
    public DbSet<Driver> Drivers { get; set; }
}

public class RaceResult
{
    [Key]
    public int Id { get; set; }
    public int RaceId { get; set; }
    public Race Race { get; set; }
    public int Position { get; set; }
    public string Driver { get; set; }
    public string Team { get; set; }
    public int Points { get; set; }
    public string DNF { get; set; }
    public int Pos_Change { get; set; }
    public int Qualifying { get; set; }
}

public class User
{
    [Key]
    public int Id { get; set; }
    [Required]
    public string Username { get; set; }
    [Required]
    public string PasswordHash { get; set; }
    [Required]
    public string Email { get; set; }
    public string Role { get; set; } = "User"; // Standaard rol
    public int LoginCount { get; set; } = 0; // Hoe vaak ingelogd
}

public class Race{
    [Key]
    public int Id { get; set; }
    public string Name { get; set; }
    public int F1_Game { get; set; }
    public int Season { get; set; }
    public int Division { get; set; }
    public int Round { get; set; }
    public string Sprint { get; set; }
    public Track Track { get; set; }
    public string? YoutubeLink { get; set; }
}

public class Track{
    [Key]
    public int Id { get; set; }
    public string Name { get; set; }
    public string Country { get; set; }
}

public class Driver{
    [Key]
    public int Id { get; set; }
    public string Name { get; set; }
    public string? Country { get; set; }
    public User? User { get; set; }
    public int? UserId { get; set; }
}
