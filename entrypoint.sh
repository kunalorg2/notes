#!/bin/sh
set -e

# Start the FastAPI backend
cd /backend || { echo "Backend directory not found"; exit 1; }
uvicorn server:app --host 127.0.0.1 --port 8001 &
BACKEND_PID=$!

# Start Nginx
nginx -g 'daemon off;' &
NGINX_PID=$!

# Handle termination signals
trap 'kill $BACKEND_PID $NGINX_PID; exit 0' SIGTERM SIGINT

# Check if processes are still running
while kill -0 $BACKEND_PID 2>/dev/null && kill -0 $NGINX_PID 2>/dev/null; do
    sleep 1
done

# If we get here, one of the processes died
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "Nginx died, shutting down backend..."
    kill $BACKEND_PID
else
    echo "Backend died, shutting down nginx..."
    kill $NGINX_PID
fi

exit 1
