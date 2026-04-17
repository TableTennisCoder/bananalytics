// Package userauth provides user authentication (sessions, passwords) for dashboard users.
// This is separate from the API key auth in internal/auth/ which is for SDK/program access.
package userauth

import (
	"errors"

	"golang.org/x/crypto/bcrypt"
)

const (
	// BcryptCost — 12 is the production-safe default (~250ms per hash on modern hardware).
	BcryptCost = 12

	// MinPasswordLength enforces a minimum password length.
	MinPasswordLength = 8
)

// ErrPasswordTooShort is returned when the password is below the minimum length.
var ErrPasswordTooShort = errors.New("password must be at least 8 characters")

// HashPassword bcrypt-hashes a plaintext password.
func HashPassword(password string) (string, error) {
	if len(password) < MinPasswordLength {
		return "", ErrPasswordTooShort
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), BcryptCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// VerifyPassword checks a plaintext password against a bcrypt hash.
// Returns true if they match.
func VerifyPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}
