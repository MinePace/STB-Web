using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace STB_Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddResultsPenalty : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Penalty",
                table: "RaceResults",
                type: "INTEGER",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Penalty",
                table: "RaceResults");
        }
    }
}
