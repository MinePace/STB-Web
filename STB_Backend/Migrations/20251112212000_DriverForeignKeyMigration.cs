using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace STB_Backend.Migrations
{
    /// <inheritdoc />
    public partial class DriverForeignKeyMigration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Driver",
                table: "RaceResults");

            migrationBuilder.AddColumn<int>(
                name: "DriverId",
                table: "RaceResults",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_RaceResults_DriverId",
                table: "RaceResults",
                column: "DriverId");

            migrationBuilder.AddForeignKey(
                name: "FK_RaceResults_Drivers_DriverId",
                table: "RaceResults",
                column: "DriverId",
                principalTable: "Drivers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RaceResults_Drivers_DriverId",
                table: "RaceResults");

            migrationBuilder.DropIndex(
                name: "IX_RaceResults_DriverId",
                table: "RaceResults");

            migrationBuilder.DropColumn(
                name: "DriverId",
                table: "RaceResults");

            migrationBuilder.AddColumn<string>(
                name: "Driver",
                table: "RaceResults",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }
    }
}
