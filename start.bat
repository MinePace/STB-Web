@echo off
cd STB_Backend
start dotnet watch run

cd ../STB_Frontend
start npm run dev

echo Both backend and frontend are running...
pause