#!/bin/bash

# ClipForge - Stop Script
# This script stops all running services

echo "🛑 Stopping ClipForge..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Stop backend
if [ -f .logs/backend.pid ]; then
  BACKEND_PID=$(cat .logs/backend.pid)
  if ps -p $BACKEND_PID > /dev/null 2>&1; then
    echo -e "Stopping backend (PID: $BACKEND_PID)..."
    kill $BACKEND_PID
    echo -e "${GREEN}✓ Backend stopped${NC}"
  fi
  rm .logs/backend.pid
fi

# Stop frontend
if [ -f .logs/frontend.pid ]; then
  FRONTEND_PID=$(cat .logs/frontend.pid)
  if ps -p $FRONTEND_PID > /dev/null 2>&1; then
    echo -e "Stopping frontend (PID: $FRONTEND_PID)..."
    kill $FRONTEND_PID
    echo -e "${GREEN}✓ Frontend stopped${NC}"
  fi
  rm .logs/frontend.pid
fi

# Stop Redis
echo -e "Stopping Redis..."
if docker ps --format '{{.Names}}' | grep -q "^clipforge-redis$"; then
  docker stop clipforge-redis > /dev/null 2>&1
  echo -e "${GREEN}✓ Redis stopped${NC}"
else
  echo -e "${GREEN}✓ Redis already stopped${NC}"
fi

echo ""
echo -e "${GREEN}All services stopped!${NC}"
