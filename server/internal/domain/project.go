package domain

import "time"

// Project represents an analytics project with associated API keys.
type Project struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	WriteKey  string    `json:"write_key"`
	SecretKey string    `json:"secret_key"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// KeyType identifies the type of API key used for authentication.
type KeyType int

const (
	// KeyTypeWrite grants access to ingestion endpoints only.
	KeyTypeWrite KeyType = iota
	// KeyTypeSecret grants access to query and management endpoints.
	KeyTypeSecret
)
