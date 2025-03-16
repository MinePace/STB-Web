using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace STB_Backend.Migrations
{
    /// <inheritdoc />
    public partial class MoveRaceNameToTrack3 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Name",
                table: "Races");

            migrationBuilder.AddColumn<string>(
                name: "RaceName",
                table: "Tracks",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RaceName",
                table: "Tracks");

            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "Races",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }
    }
}
