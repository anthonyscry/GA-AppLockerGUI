#!/bin/bash
# Quick start script for GA-AppLocker Lab Environment

set -e

echo "=========================================="
echo "GA-AppLocker Lab Environment - Quick Start"
echo "=========================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version > /dev/null 2>&1; then
    echo "❌ Docker Compose is not available. Please install Docker Compose v2.0+"
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Ask user which setup to use
echo "Select setup type:"
echo "1) Linux containers (AD simulation, faster startup)"
echo "2) Windows containers (full AppLocker support, requires Windows)"
echo ""
read -p "Enter choice [1 or 2]: " choice

case $choice in
    1)
        COMPOSE_FILE="docker-compose.yml"
        echo "Using Linux containers..."
        ;;
    2)
        COMPOSE_FILE="docker-compose.windows.yml"
        echo "Using Windows containers..."
        echo "⚠️  Make sure Windows containers are enabled in Docker Desktop!"
        ;;
    *)
        echo "Invalid choice. Using Linux containers..."
        COMPOSE_FILE="docker-compose.yml"
        ;;
esac

echo ""
echo "Starting lab environment..."
echo ""

# Build and start containers
docker compose -f $COMPOSE_FILE up -d --build

echo ""
echo "Waiting for services to initialize..."
sleep 10

# Show container status
echo ""
echo "Container Status:"
docker compose -f $COMPOSE_FILE ps

echo ""
echo "=========================================="
echo "Lab environment is starting!"
echo "=========================================="
echo ""
echo "To view logs:"
echo "  docker compose -f $COMPOSE_FILE logs -f"
echo ""
echo "To stop:"
echo "  docker compose -f $COMPOSE_FILE down"
echo ""
echo "To access app container:"
echo "  docker exec -it ga-applocker-app powershell"
echo ""
echo "Default credentials:"
echo "  Domain: applocker.local"
echo "  Admin: Administrator / SecurePass123!"
echo ""
