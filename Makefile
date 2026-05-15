.PHONY: dev web api db install setup seed clean status stop logs help

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
OVERMIND_SOCKET := ./.overmind.sock
PROCFILE        := Procfile.dev

# ---------------------------------------------------------------------------
# Primary targets
# ---------------------------------------------------------------------------

dev: _require_overmind _require_supabase ## Start all services (web + api) via overmind
	overmind start -f $(PROCFILE)

web: _require_overmind ## Start only the Next.js frontend
	overmind start -f $(PROCFILE) -l web

api: _require_overmind ## Start only the Python AI service
	overmind start -f $(PROCFILE) -l api

db: ## Start Supabase (Postgres, Auth, Storage, Studio)
	supabase start

stop: ## Stop Supabase
	supabase stop

status: ## Show Supabase service status
	supabase status

# ---------------------------------------------------------------------------
# Setup & install
# ---------------------------------------------------------------------------

install: ## Install all dependencies (Node + Python)
	npm install
	cd ai-service && uv sync

seed: ## Seed the database via Prisma
	npx prisma db seed

setup: install db seed ## Full first-time setup: install deps, start Supabase, seed DB
	@echo ""
	@echo "Setup complete. Run 'make dev' to start all services."

# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

logs: ## Tail logs for a specific service: make logs s=web
	overmind log $(s)

clean: ## Remove build artifacts and caches
	rm -rf .next node_modules/.cache ai-service/__pycache__

# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------

_require_overmind:
	@command -v overmind >/dev/null 2>&1 || { \
		echo "Error: overmind is not installed."; \
		echo "  brew install overmind"; \
		exit 1; \
	}

_require_supabase:
	@supabase status >/dev/null 2>&1 || { \
		echo "Error: Supabase is not running. Start it first:"; \
		echo "  make db"; \
		exit 1; \
	}

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
