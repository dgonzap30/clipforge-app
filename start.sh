#!/bin/bash

# ClipForge - Easy Start Script
# This script starts all services needed for local development

echo "🔥 Starting ClipForge..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is running (optional for Redis)
REDIS_RUNNING=false
if docker info > /dev/null 2>&1; then
  echo -e "${BLUE}Starting Redis...${NC}"

  # Stop and remove any existing container
  docker stop clipforge-redis > /dev/null 2>&1 || true
  docker rm clipforge-redis > /dev/null 2>&1 || true

  # Start fresh Redis container
  if docker run -d --name clipforge-redis -p 6379:6379 redis:7-alpine > /dev/null 2>&1; then
    REDIS_RUNNING=true
    echo -e "${GREEN}✓ Redis started${NC}"
  else
    echo -e "${YELLOW}⚠ Redis failed to start (continuing without it)${NC}"
  fi
else
  echo -e "${YELLOW}⚠ Docker not running (Redis disabled - job queue won't work)${NC}"
fi
echo ""

# Sync dependencies (fast when already installed, catches lockfile drift)
echo -e "${BLUE}Syncing frontend dependencies...${NC}"
bun install > /dev/null 2>&1
echo -e "${GREEN}✓ Frontend dependencies synced${NC}"
echo ""

echo -e "${BLUE}Syncing server dependencies...${NC}"
cd server && bun install > /dev/null 2>&1 && cd ..
echo -e "${GREEN}✓ Server dependencies synced${NC}"
echo ""

# Create log directory
mkdir -p .logs

# Start backend in background
echo -e "${BLUE}Starting backend server...${NC}"
cd server
bun dev > ../.logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..
echo $BACKEND_PID > .logs/backend.pid
echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"
echo ""

# Wait a moment for backend to start
sleep 2

# Start frontend in background
echo -e "${BLUE}Starting frontend...${NC}"
bun dev > .logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > .logs/frontend.pid
echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}🎉 ClipForge is running!${NC}"
echo ""
echo -e "  Frontend:  ${BLUE}http://localhost:5173${NC}"
echo -e "  Backend:   ${BLUE}http://localhost:8787${NC}"
if [ "$REDIS_RUNNING" = true ]; then
  echo -e "  Redis:     ${GREEN}Running${NC}"
else
  echo -e "  Redis:     ${YELLOW}Disabled${NC}"
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo "  Backend:  tail -f .logs/backend.log"
echo "  Frontend: tail -f .logs/frontend.log"
echo ""
echo -e "${YELLOW}To stop all services:${NC}"
echo "  ./stop.sh"
echo ""

# Keep script running and tail logs
echo "Showing live logs (Ctrl+C to exit, services will keep running)..."
echo ""
sleep 2

# Show combined logs
tail -f .logs/backend.log -f .logs/frontend.log 2>/dev/null
