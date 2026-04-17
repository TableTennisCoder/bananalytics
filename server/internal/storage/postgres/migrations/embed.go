// Package migrations exposes the embedded SQL migration files as a virtual filesystem.
// This allows the Go binary to ship its migrations and apply them at startup
// without requiring users to run SQL files manually.
package migrations

import "embed"

// FS contains all .sql migration files in this directory.
// File naming convention: {version}_{description}.{up|down}.sql
// Example: 005_add_users.up.sql / 005_add_users.down.sql
//
//go:embed *.sql
var FS embed.FS
