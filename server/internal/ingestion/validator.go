package ingestion

import (
	"fmt"

	"github.com/rochade-analytics/server/internal/domain"
)

// ValidateBatch validates a batch of events and separates valid from invalid.
// Returns valid events, and a list of error messages for rejected events.
func ValidateBatch(batch []domain.Event) (valid []domain.Event, errors []string) {
	if len(batch) == 0 {
		errors = append(errors, "batch is empty")
		return nil, errors
	}

	if len(batch) > domain.MaxBatchSize {
		errors = append(errors, fmt.Sprintf("batch size %d exceeds maximum of %d", len(batch), domain.MaxBatchSize))
		return nil, errors
	}

	for i := range batch {
		if err := batch[i].Validate(); err != nil {
			errors = append(errors, fmt.Sprintf("event[%d]: %s", i, err.Error()))
			continue
		}
		valid = append(valid, batch[i])
	}

	return valid, errors
}
