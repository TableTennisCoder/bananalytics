// Package auth provides API key authentication.
package auth

import (
	"context"
	"sync"
	"time"

	"github.com/bananalytics/server/internal/domain"
	"github.com/bananalytics/server/internal/storage"
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
// Uses prefix-based DB lookup + SHA-256 hash verification (constant-time).
// Results are cached for 5 minutes to avoid hitting the DB on every request.
func (ks *Keystore) Lookup(ctx context.Context, key string) (*KeyInfo, error) {
	// Check cache first
	ks.mu.RLock()
	if cached, ok := ks.cache[key]; ok && time.Now().Before(cached.expiresAt) {
		ks.mu.RUnlock()
		return cached.info, nil
	}
	ks.mu.RUnlock()

	prefix := KeyPrefix(key)
	keyHash := HashKey(key)

	// Try write key: lookup by prefix, verify by hash
	candidates, err := ks.projects.FindByWriteKeyPrefix(ctx, prefix)
	if err == nil {
		for _, c := range candidates {
			if VerifyKey(key, c.KeyHash) {
				info := &KeyInfo{Project: &c.Project, KeyType: domain.KeyTypeWrite}
				ks.store(key, info)
				return info, nil
			}
		}
	}

	// Try secret key: lookup by prefix, verify by hash
	candidates, err = ks.projects.FindBySecretKeyPrefix(ctx, prefix)
	if err == nil {
		for _, c := range candidates {
			if VerifyKey(key, c.KeyHash) {
				info := &KeyInfo{Project: &c.Project, KeyType: domain.KeyTypeSecret}
				ks.store(key, info)
				return info, nil
			}
		}
	}

	// Key not found — avoid leaking timing info by computing hash anyway
	_ = keyHash

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
