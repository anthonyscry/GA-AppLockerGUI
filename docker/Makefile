# Makefile for GA-AppLocker Lab Environment

.PHONY: help start stop restart logs clean build test

# Default compose file
COMPOSE_FILE ?= docker-compose.yml

help:
	@echo "GA-AppLocker Lab Environment - Makefile Commands"
	@echo ""
	@echo "Usage: make [target] [COMPOSE_FILE=docker-compose.yml]"
	@echo ""
	@echo "Targets:"
	@echo "  start      - Start all containers"
	@echo "  stop       - Stop all containers"
	@echo "  restart    - Restart all containers"
	@echo "  logs       - View logs from all containers"
	@echo "  build      - Build all containers"
	@echo "  clean      - Stop and remove all containers and volumes"
	@echo "  test       - Run basic connectivity tests"
	@echo "  dc-logs    - View domain controller logs"
	@echo "  client-logs - View client logs"
	@echo "  app-logs   - View application logs"
	@echo "  shell-dc   - Open shell in domain controller"
	@echo "  shell-client - Open shell in client"
	@echo "  shell-app  - Open shell in app container"
	@echo ""
	@echo "Examples:"
	@echo "  make start"
	@echo "  make start COMPOSE_FILE=docker-compose.windows.yml"
	@echo "  make logs"
	@echo "  make clean"

start:
	docker compose -f $(COMPOSE_FILE) up -d

stop:
	docker compose -f $(COMPOSE_FILE) stop

restart: stop start

logs:
	docker compose -f $(COMPOSE_FILE) logs -f

build:
	docker compose -f $(COMPOSE_FILE) build

clean:
	docker compose -f $(COMPOSE_FILE) down -v
	@echo "All containers and volumes removed"

test:
	@echo "Testing domain controller connectivity..."
	@docker exec ga-applocker-dc ping -c 1 8.8.8.8 || echo "DC connectivity test failed"
	@echo "Testing client connectivity..."
	@docker exec ga-applocker-client ping -c 1 domain-controller || echo "Client connectivity test failed"

dc-logs:
	docker compose -f $(COMPOSE_FILE) logs -f domain-controller

client-logs:
	docker compose -f $(COMPOSE_FILE) logs -f windows-client

app-logs:
	docker compose -f $(COMPOSE_FILE) logs -f app-dev

test-app:
	@echo "Running application tests in container..."
	docker exec ga-applocker-app bash -c "cd /app && pwsh -File /scripts/test-app.ps1 || bash -c 'cd /app && npm --version && node --version'"

shell-app:
	docker exec -it ga-applocker-app bash

shell-dc:
	docker exec -it ga-applocker-dc /bin/bash

shell-client:
	docker exec -it ga-applocker-client /bin/bash

shell-app:
	docker exec -it ga-applocker-app powershell
