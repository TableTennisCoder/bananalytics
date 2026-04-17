package postgres

import (
	"errors"
	"fmt"
	"log/slog"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres" // postgres driver
	"github.com/golang-migrate/migrate/v4/source/iofs"

	"github.com/bananalytics/server/internal/storage/postgres/migrations"
)

// RunMigrations applies all pending database migrations.
//
// On every server startup, this function:
//   1. Connects to the database using the given DSN
//   2. Reads the embedded migration files (compiled into the binary via go:embed)
//   3. Checks the schema_migrations table for the current version
//   4. Applies any migrations newer than the current version, in order
//   5. Returns nil if everything is up-to-date
//
// If a migration fails, the server should refuse to start (don't run on a
// half-migrated DB). Use migrate.ErrNoChange to detect "nothing to apply".
func RunMigrations(dsn string, logger *slog.Logger) error {
	src, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("load embedded migrations: %w", err)
	}

	m, err := migrate.NewWithSourceInstance("iofs", src, dsn)
	if err != nil {
		return fmt.Errorf("create migrate instance: %w", err)
	}
	defer func() {
		// Close releases the source and database — but keeps any acquired locks
		// released. We log close errors but don't fail startup over them.
		if srcErr, dbErr := m.Close(); srcErr != nil || dbErr != nil {
			logger.Warn("migrate close had errors", "src_err", srcErr, "db_err", dbErr)
		}
	}()

	// Get current version before applying
	beforeVersion, _, _ := m.Version()

	if err := m.Up(); err != nil {
		if errors.Is(err, migrate.ErrNoChange) {
			logger.Info("migrations: database already up-to-date", "version", beforeVersion)
			return nil
		}
		return fmt.Errorf("apply migrations: %w", err)
	}

	afterVersion, _, _ := m.Version()
	logger.Info("migrations: applied successfully",
		"from_version", beforeVersion,
		"to_version", afterVersion,
	)
	return nil
}
