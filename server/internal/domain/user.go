package domain

import "time"

// User represents a human dashboard user.
type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"` // never serialized
	Name         string    `json:"name"`
	IsAdmin      bool      `json:"is_admin"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Session represents a server-side authenticated session.
type Session struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	TokenHash string    `json:"-"` // never serialized
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
	UserAgent string    `json:"user_agent,omitempty"`
	IP        string    `json:"ip,omitempty"`
}

// ProjectMember links a user to a project with a role.
type ProjectMember struct {
	UserID    string    `json:"user_id"`
	ProjectID string    `json:"project_id"`
	Role      string    `json:"role"` // 'owner' | 'member'
	CreatedAt time.Time `json:"created_at"`
}
