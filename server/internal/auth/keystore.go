// Package auth provides API key authentication.
package auth

import (
	"context"
	"sync"
	"time"

	"github.com/rochade-analytics/server/internal/domain"
	"github.com/rochade-analytics/server/internal/storage"
)

// KeyInfo holds cached key lookup results.
type KeyInfo struct {
	Project *domain.Project
	KeyType domain.KeyType
}

// Keystore looks up and caches API key information.
type Keystore struct {
	projects storage.ProjectRepository
	cache    map[string]*cachedKey
	mu       sync.RWMutex
	ttl      time.Duration
}

type cachedKey struct {
	info      *KeyInfo
	expiresAt time.Time
}

const defaultCacheTTL = 5 * time.Minute

// NewKeystore creates a new Keystore with the given project repository.
func NewKeystore(projects storage.ProjectRepository) *Keystore {
	return &Keystore{
		projects: projects,
		cache:    make(map[string]*cachedKey),
		ttl:      defaultCacheTTL,
	}
}

// Lookup resolves an API key to its project and key type.
// Results are cached for 5 minutes to avoid hitting the DB on every request.
func (ks *Keystore) Lookup(ctx context.Context, key string) (*KeyInfo, error) {
	ks.mu.RLock()
	if cached, ok := ks.cache[key]; ok && time.Now().Before(cached.expiresAt) {
		ks.mu.RUnlock()
		return cached.info, nil
	}
	ks.mu.RUnlock()

	// Try write key first
	project, err := ks.projects.FindByWriteKey(ctx, key)
	if err == nil {
		info := &KeyInfo{Project: project, KeyType: domain.KeyTypeWrite}
		ks.store(key, info)
		return info, nil
	}

	// Try secret key
	project, err = ks.projects.FindBySecretKey(ctx, key)
	if err == nil {
		info := &KeyInfo{Project: project, KeyType: domain.KeyTypeSecret}
		ks.store(key, info)
		return info, nil
	}

	return nil, &domain.ErrUnauthorized{Reason: "invalid API key"}
}

func (ks *Keystore) store(key string, info *KeyInfo) {
	ks.mu.Lock()
	ks.cache[key] = &cachedKey{
		info:      info,
		expiresAt: time.Now().Add(ks.ttl),
	}
	ks.mu.Unlock()
}
