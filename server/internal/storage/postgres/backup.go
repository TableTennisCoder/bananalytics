package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bananalytics/server/internal/storage"
)

// BackupStore reads the rows scripts/backup.sh writes after each run.
type BackupStore struct {
	pool *pgxpool.Pool
}

// NewBackupStore creates a store over the given pool.
func NewBackupStore(pool *pgxpool.Pool) *BackupStore {
	return &BackupStore{pool: pool}
}

const queryBackupRunsSQL = `
	SELECT started_at, finished_at, status, bytes, path, remote, message
	FROM backup_runs
	ORDER BY finished_at DESC
	LIMIT $1`

// QueryBackupRuns returns the most recent runs, newest first.
func (s *BackupStore) QueryBackupRuns(ctx context.Context, limit int) ([]storage.BackupRun, error) {
	if limit <= 0 {
		limit = 10
	}

	rows, err := s.pool.Query(ctx, queryBackupRunsSQL, limit)
	if err != nil {
		return nil, fmt.Errorf("query backup runs: %w", err)
	}
	defer rows.Close()

	runs := make([]storage.BackupRun, 0, limit)
	for rows.Next() {
		var r storage.BackupRun
		if err := rows.Scan(&r.StartedAt, &r.FinishedAt, &r.Status, &r.Bytes, &r.Path, &r.Remote, &r.Message); err != nil {
			return nil, fmt.Errorf("scan backup run: %w", err)
		}
		runs = append(runs, r)
	}
	return runs, rows.Err()
}
