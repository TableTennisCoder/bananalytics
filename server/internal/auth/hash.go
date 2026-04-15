package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
)

const (
	// PrefixLength is the number of characters stored as a lookup prefix.
	// This allows DB lookups without hashing every candidate.
	PrefixLength = 8
)

// HashKey produces a SHA-256 hex digest of the given API key.
func HashKey(key string) string {
	h := sha256.Sum256([]byte(key))
	return hex.EncodeToString(h[:])
}

// KeyPrefix returns the first PrefixLength characters of a key.
// Used for fast DB lookups before verifying the full hash.
func KeyPrefix(key string) string {
	if len(key) <= PrefixLength {
		return key
	}
	return key[:PrefixLength]
}

// VerifyKey compares a plaintext key against its stored hash using constant-time comparison.
func VerifyKey(plaintext, storedHash string) bool {
	computed := HashKey(plaintext)
	return subtle.ConstantTimeCompare([]byte(computed), []byte(storedHash)) == 1
}

// GenerateKey creates a new random API key with the given prefix (e.g., "rk_" or "sk_").
func GenerateKey(prefix string) (string, error) {
	bytes := make([]byte, 24)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generate key: %w", err)
	}
	return prefix + hex.EncodeToString(bytes), nil
}
