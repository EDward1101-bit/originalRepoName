.PHONY: help test test-unit test-integration test-coverage lint format clean install

help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	pip install -r requirements.txt

test: ## Run all tests
	pytest

test-unit: ## Run unit tests only
	pytest -m unit

test-integration: ## Run integration tests only
	pytest -m integration

test-slow: ## Run slow tests only
	pytest -m slow

test-external: ## Run external service tests only
	pytest -m external

test-coverage: ## Run tests with coverage report
	pytest --cov=. --cov-report=html --cov-report=term

test-verbose: ## Run tests with verbose output
	pytest -v

test-watch: ## Run tests in watch mode
	pytest-watch

lint: ## Run linting
	ruff check .
	mypy .

format: ## Format code
	ruff format .

clean: ## Clean up test artifacts
	rm -rf .pytest_cache
	rm -rf htmlcov
	rm -rf .coverage
	rm -rf coverage.xml
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

ci: ## Run CI checks (lint + test)
	$(MAKE) lint
	$(MAKE) test-coverage

dev-setup: ## Set up development environment
	$(MAKE) install
	pre-commit install
