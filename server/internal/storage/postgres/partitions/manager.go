// Package partitions manages automatic creation of monthly event table partitions.
package partitions

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Manager handles automatic partition creation for the events table.
type Manager struct {
	pool   *pgxpool.Pool
	logger *slog.Logger
}

// NewManager creates a new partition manager.
func NewManager(pool *pgxpool.Pool, logger *slog.Logger) *Manager {
	return &Manager{pool: pool, logger: logger}
}

// EnsurePartitions creates partitions for the next N months from now.
// Safe to call multiple times — uses IF NOT EXISTS.
func (m *Manager) EnsurePartitions(ctx context.Context, monthsAhead int) error {
	now := time.Now().UTC()

	for i := 0; i < monthsAhead; i++ {
		target := now.AddDate(0, i, 0)
		if err := m.createPartition(ctx, target); err != nil {
			return fmt.Errorf("create partition for %s: %w", target.Format("2006-01"), err)
		}
	}

	m.logger.Info("partitions ensured", "months_ahead", monthsAhead)
	return nil
}

func (m *Manager) createPartition(ctx context.Context, t time.Time) error {
	year := t.Year()
	month := int(t.Month())

	name := fmt.Sprintf("events_%04d_%02d", year, month)
	rangeStart := fmt.Sprintf("%04d-%02d-01", year, month)

	// Calculate next month
	next := t.AddDate(0, 1, 0)
	rangeEnd := fmt.Sprintf("%04d-%02d-01", next.Year(), int(next.Month()))

	query := fmt.Sprintf(
		`CREATE TABLE IF NOT EXISTS %s PARTITION OF events FOR VALUES FROM ('%s') TO ('%s')`,
		name, rangeStart, rangeEnd,
	)

	_, err := m.pool.Exec(ctx, query)
	if err != nil {
		return err
	}

	m.logger.Debug("partition ensured", "name", name, "from", rangeStart, "to", rangeEnd)
	return nil
}

// StartAutoCreation runs a background goroutine that creates partitions
// for the next 3 months every 24 hours.
func (m *Manager) StartAutoCreation(ctx context.Context) {
	// Create partitions immediately on startup
	if err := m.EnsurePartitions(ctx, 3); err != nil {
		m.logger.Error("initial partition creation failed", "error", err)
	}

	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				m.logger.Info("partition auto-creation stopped")
				return
			case <-ticker.C:
				if err := m.EnsurePartitions(ctx, 3); err != nil {
					m.logger.Error("auto partition creation failed", "error", err)
				}
			}
		}
	}()
}
