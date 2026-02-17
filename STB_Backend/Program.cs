using Microsoft.Data.Sqlite;
using System.IO;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Resolve the sqlite connection to an absolute file path
var rawConn = builder.Configuration.GetConnectionString("sqlite") 
              ?? throw new InvalidOperationException("Missing ConnectionStrings:sqlite");

var csb = new SqliteConnectionStringBuilder
{
    DataSource = rawConn
};

// If the DataSource is relative, make it relative to ContentRoot (project/app folder)
if (!Path.IsPathRooted(csb.DataSource))
{
    csb.DataSource = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, csb.DataSource));
}

// Ensure the directory exists
Directory.CreateDirectory(Path.GetDirectoryName(csb.DataSource)!);

// Log the final resolved path
Console.WriteLine($"[DB] SQLite DataSource resolved to: {csb.DataSource}");

Console.WriteLine("---- FILE CHECK ----");
Console.WriteLine("ContentRootPath: " + builder.Environment.ContentRootPath);

var dataDir = Path.Combine(builder.Environment.ContentRootPath, "Data");

if (Directory.Exists(dataDir))
{
    Console.WriteLine("Data folder exists. Files:");
    foreach (var file in Directory.GetFiles(dataDir))
    {
        var info = new FileInfo(file);
        Console.WriteLine($" - {file} ({info.Length} bytes)");
    }
}
else
{
    Console.WriteLine("Data folder NOT found at: " + dataDir);
}

// Use this final connection string
var finalConnString = csb.ToString();

// Set up the database context
builder.Services.AddDbContext<DataContext>(options =>
    options.UseSqlite(finalConnString));

builder.Services.AddControllers();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAllOrigins",
        policy => policy.AllowAnyOrigin()
                        .AllowAnyMethod()
                        .AllowAnyHeader());
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// ✅ Apply Migrations on Startup
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<DataContext>();
        // dbContext.Database.EnsureCreated(); // 👈 faster, no migrations
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowAllOrigins");
app.UseAuthorization();
app.MapControllers();

var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
app.Run($"http://0.0.0.0:{port}");