// Package clock provides a testable time abstraction.
package clock

import "time"

// Clock abstracts time operations for testability.
type Clock interface {
	Now() time.Time
}

// Real returns the actual system time.
type Real struct{}

// Now returns the current time.
func (Real) Now() time.Time { return time.Now() }

// Mock is a controllable clock for tests.
type Mock struct {
	NowFunc func() time.Time
}

// Now returns the mocked time.
func (m Mock) Now() time.Time {
	if m.NowFunc != nil {
		return m.NowFunc()
	}
	return time.Now()
}
