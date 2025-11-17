using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace STB_Backend.Migrations
{
    /// <inheritdoc />
    public partial class TeamForeignKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Team",
                table: "RaceResults");

            migrationBuilder.CreateIndex(
                name: "IX_RaceResults_TeamId",
                table: "RaceResults",
                column: "TeamId");

            migrationBuilder.AddForeignKey(
                name: "FK_RaceResults_Teams_TeamId",
                table: "RaceResults",
                column: "TeamId",
                principalTable: "Teams",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RaceResults_Teams_TeamId",
                table: "RaceResults");

            migrationBuilder.DropIndex(
                name: "IX_RaceResults_TeamId",
                table: "RaceResults");

            migrationBuilder.AddColumn<string>(
                name: "Team",
                table: "RaceResults",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }
    }
}
