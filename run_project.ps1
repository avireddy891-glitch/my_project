# Start the backend node server in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; title Backend Server; npm start"

# Start the simulator in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; title Simulator; npm run simulate"

# Wait a couple of seconds to ensure servers are up
Start-Sleep -Seconds 3

# Open the dashboard in the default web browser
Start-Process "http://localhost:3000"
