#!/bin/bash

echo "Starting backend on port 8256.."
(
    source .venv/bin/activate
    cd backend
    gunicorn main:app \
        -k uvicorn.workers.UvicornWorker \
        --workers 1 \
        --bind 0.0.0.0:8256
) &

echo "Starting frontend on port 4738..."
(
    cd frontend
    npm run dev -- --host 0.0.0.0 --port 4738
) &

echo "Both Backend and Frontend started!"
wait