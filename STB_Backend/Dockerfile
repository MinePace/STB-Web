# Use .NET 8.0 SDK to build the app
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Copy the project file and restore dependencies
COPY STB_Backend.csproj ./
RUN dotnet restore STB_Backend.csproj

# Copy the entire backend source code and build
COPY . .
RUN dotnet publish -c Release -o out

# Use .NET 8.0 runtime for deployment
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/out .

# Expose API port
EXPOSE 5110

# Start the API
CMD ["dotnet", "STB_Backend.dll"]
