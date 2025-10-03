using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace STB_Backend.Migrations
{
    /// <inheritdoc />
    public partial class TeamDataUpdate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TeamId",
                table: "SeasonalTeamDrivers",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_SeasonalTeamDrivers_TeamId",
                table: "SeasonalTeamDrivers",
                column: "TeamId");

            migrationBuilder.AddForeignKey(
                name: "FK_SeasonalTeamDrivers_Teams_TeamId",
                table: "SeasonalTeamDrivers",
                column: "TeamId",
                principalTable: "Teams",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SeasonalTeamDrivers_Teams_TeamId",
                table: "SeasonalTeamDrivers");

            migrationBuilder.DropIndex(
                name: "IX_SeasonalTeamDrivers_TeamId",
                table: "SeasonalTeamDrivers");

            migrationBuilder.DropColumn(
                name: "TeamId",
                table: "SeasonalTeamDrivers");
        }
    }
}
