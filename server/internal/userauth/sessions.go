package userauth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"time"
)

const (
	// SessionTTL is how long a session is valid after creation.
	SessionTTL = 7 * 24 * time.Hour

	// SessionTokenBytes is the size of the random session token (in bytes, before encoding).
	SessionTokenBytes = 32

	// SessionCookieName is the cookie name for the user session token.
	SessionCookieName = "banana_user_session"
)

// GenerateToken creates a cryptographically random session token.
func GenerateToken() (string, error) {
	b := make([]byte, SessionTokenBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString(b), nil
}

// HashToken returns the SHA-256 hex hash of the token, used for DB lookups.
// We never store the raw token — only its hash. This way DB compromise
// doesn't expose active sessions.
func HashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

// SessionExpiry returns the expiration time for a new session.
func SessionExpiry() time.Time {
	return time.Now().UTC().Add(SessionTTL)
}
