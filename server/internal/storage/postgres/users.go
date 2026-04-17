package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bananalytics/server/internal/domain"
	"github.com/bananalytics/server/internal/storage"
)

const (
	insertUserQuery = `
		INSERT INTO users (id, email, password_hash, name, is_admin, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`

	findUserByIDQuery = `
		SELECT id, email, password_hash, name, is_admin, created_at, updated_at
		FROM users WHERE id = $1`

	findUserByEmailQuery = `
		SELECT id, email, password_hash, name, is_admin, created_at, updated_at
		FROM users WHERE LOWER(email) = LOWER($1)`

	countUsersQuery = `SELECT COUNT(*) FROM users`

	insertSessionQuery = `
		INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, user_agent, ip)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`

	findSessionByTokenHashQuery = `
		SELECT id, user_id, token_hash, expires_at, created_at, user_agent, ip
		FROM sessions WHERE token_hash = $1`

	deleteSessionByTokenHashQuery = `DELETE FROM sessions WHERE token_hash = $1`

	deleteExpiredSessionsQuery = `DELETE FROM sessions WHERE expires_at < NOW()`

	insertProjectMemberQuery = `
		INSERT INTO project_members (user_id, project_id, role, created_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (user_id, project_id) DO NOTHING`

	listUserProjectsQuery = `
		SELECT p.id, p.name, p.write_key, p.secret_key, p.created_at, p.updated_at
		FROM projects p
		INNER JOIN project_members pm ON pm.project_id = p.id
		WHERE pm.user_id = $1
		ORDER BY p.created_at DESC`

	checkProjectMembershipQuery = `
		SELECT role FROM project_members WHERE user_id = $1 AND project_id = $2`
)

// UserStore implements storage.UserRepository using PostgreSQL.
type UserStore struct {
	pool *pgxpool.Pool
}

func NewUserStore(pool *pgxpool.Pool) *UserStore {
	return &UserStore{pool: pool}
}

func (s *UserStore) Create(ctx context.Context, u *domain.User) error {
	_, err := s.pool.Exec(ctx, insertUserQuery,
		u.ID, u.Email, u.PasswordHash, u.Name, u.IsAdmin, u.CreatedAt, u.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

func (s *UserStore) FindByID(ctx context.Context, id string) (*domain.User, error) {
	return s.scanUser(ctx, findUserByIDQuery, id)
}

func (s *UserStore) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	return s.scanUser(ctx, findUserByEmailQuery, email)
}

func (s *UserStore) Count(ctx context.Context) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx, countUsersQuery).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count users: %w", err)
	}
	return count, nil
}

func (s *UserStore) scanUser(ctx context.Context, query, arg string) (*domain.User, error) {
	var u domain.User
	err := s.pool.QueryRow(ctx, query, arg).Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.IsAdmin, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, &domain.ErrNotFound{Resource: "user", ID: arg}
		}
		return nil, fmt.Errorf("find user: %w", err)
	}
	return &u, nil
}

// SessionStore implements storage.SessionRepository using PostgreSQL.
type SessionStore struct {
	pool *pgxpool.Pool
}

func NewSessionStore(pool *pgxpool.Pool) *SessionStore {
	return &SessionStore{pool: pool}
}

func (s *SessionStore) Create(ctx context.Context, sess *domain.Session) error {
	_, err := s.pool.Exec(ctx, insertSessionQuery,
		sess.ID, sess.UserID, sess.TokenHash, sess.ExpiresAt, sess.CreatedAt, sess.UserAgent, sess.IP,
	)
	if err != nil {
		return fmt.Errorf("create session: %w", err)
	}
	return nil
}

func (s *SessionStore) FindByTokenHash(ctx context.Context, tokenHash string) (*domain.Session, error) {
	var sess domain.Session
	err := s.pool.QueryRow(ctx, findSessionByTokenHashQuery, tokenHash).Scan(
		&sess.ID, &sess.UserID, &sess.TokenHash, &sess.ExpiresAt, &sess.CreatedAt, &sess.UserAgent, &sess.IP,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, &domain.ErrNotFound{Resource: "session", ID: tokenHash[:8]}
		}
		return nil, fmt.Errorf("find session: %w", err)
	}
	return &sess, nil
}

func (s *SessionStore) DeleteByTokenHash(ctx context.Context, tokenHash string) error {
	_, err := s.pool.Exec(ctx, deleteSessionByTokenHashQuery, tokenHash)
	if err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	return nil
}

func (s *SessionStore) DeleteExpired(ctx context.Context) (int, error) {
	tag, err := s.pool.Exec(ctx, deleteExpiredSessionsQuery)
	if err != nil {
		return 0, fmt.Errorf("delete expired sessions: %w", err)
	}
	return int(tag.RowsAffected()), nil
}

// ProjectMemberStore implements storage.ProjectMemberRepository using PostgreSQL.
type ProjectMemberStore struct {
	pool *pgxpool.Pool
}

func NewProjectMemberStore(pool *pgxpool.Pool) *ProjectMemberStore {
	return &ProjectMemberStore{pool: pool}
}

func (s *ProjectMemberStore) AddMember(ctx context.Context, userID, projectID, role string) error {
	_, err := s.pool.Exec(ctx, insertProjectMemberQuery, userID, projectID, role)
	if err != nil {
		return fmt.Errorf("add project member: %w", err)
	}
	return nil
}

func (s *ProjectMemberStore) ListUserProjects(ctx context.Context, userID string) ([]domain.Project, error) {
	rows, err := s.pool.Query(ctx, listUserProjectsQuery, userID)
	if err != nil {
		return nil, fmt.Errorf("list user projects: %w", err)
	}
	defer rows.Close()

	var projects []domain.Project
	for rows.Next() {
		var p domain.Project
		if err := rows.Scan(&p.ID, &p.Name, &p.WriteKey, &p.SecretKey, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan project: %w", err)
		}
		projects = append(projects, p)
	}
	return projects, rows.Err()
}

func (s *ProjectMemberStore) IsMember(ctx context.Context, userID, projectID string) (bool, string, error) {
	var role string
	err := s.pool.QueryRow(ctx, checkProjectMembershipQuery, userID, projectID).Scan(&role)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, "", nil
		}
		return false, "", fmt.Errorf("check membership: %w", err)
	}
	return true, role, nil
}

// Compile-time interface assertions
var (
	_ storage.UserRepository          = (*UserStore)(nil)
	_ storage.SessionRepository       = (*SessionStore)(nil)
	_ storage.ProjectMemberRepository = (*ProjectMemberStore)(nil)
)
