.PHONY: build run test lint migrate-up migrate-down docker-up docker-down

build:
	go build -o bin/bananalytics ./cmd/bananalytics

run: build
	./bin/bananalytics

test:
	go test ./... -v -race

lint:
	golangci-lint run ./...

migrate-up:
	@echo "Run migrations using psql or a migration tool"
	@echo "psql $$BANANA_DB_DSN -f internal/storage/postgres/migrations/001_create_projects.up.sql"
	@echo "psql $$BANANA_DB_DSN -f internal/storage/postgres/migrations/002_create_events.up.sql"

migrate-down:
	@echo "psql $$BANANA_DB_DSN -f internal/storage/postgres/migrations/002_create_events.down.sql"
	@echo "psql $$BANANA_DB_DSN -f internal/storage/postgres/migrations/001_create_projects.down.sql"

docker-up:
	docker-compose up --build -d

docker-down:
	docker-compose down
