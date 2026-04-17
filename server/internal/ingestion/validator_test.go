package ingestion

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/bananalytics/server/internal/domain"
)

func makeValidEvent(id string) domain.Event {
	return domain.Event{
		MessageID:   id,
		EventName:   "test_event",
		Type:        "track",
		Properties:  json.RawMessage(`{}`),
		Context:     json.RawMessage(`{}`),
		AnonymousID: "anon-1",
		ClientTS:    time.Now(),
	}
}

func TestValidateBatch_Empty(t *testing.T) {
	valid, errors := ValidateBatch([]domain.Event{})
	if valid != nil {
		t.Error("expected nil valid events")
	}
	if len(errors) == 0 {
		t.Error("expected error for empty batch")
	}
}

func TestValidateBatch_ExceedsMax(t *testing.T) {
	batch := make([]domain.Event, 501)
	for i := range batch {
		batch[i] = makeValidEvent("msg-" + string(rune('a'+i%26)))
	}
	valid, errors := ValidateBatch(batch)
	if valid != nil {
		t.Error("expected nil valid events")
	}
	if len(errors) == 0 {
		t.Error("expected error for oversized batch")
	}
}

func TestValidateBatch_AllValid(t *testing.T) {
	batch := []domain.Event{makeValidEvent("1"), makeValidEvent("2")}
	valid, errors := ValidateBatch(batch)

	if len(valid) != 2 {
		t.Errorf("expected 2 valid, got %d", len(valid))
	}
	if len(errors) != 0 {
		t.Errorf("expected 0 errors, got %d: %v", len(errors), errors)
	}
}

func TestValidateBatch_MixedValidInvalid(t *testing.T) {
	invalid := domain.Event{
		MessageID:   "bad",
		EventName:   "",
		Type:        "track",
		AnonymousID: "anon-1",
		ClientTS:    time.Now(),
	}
	batch := []domain.Event{makeValidEvent("1"), invalid, makeValidEvent("2")}
	valid, errors := ValidateBatch(batch)

	if len(valid) != 2 {
		t.Errorf("expected 2 valid, got %d", len(valid))
	}
	if len(errors) != 1 {
		t.Errorf("expected 1 error, got %d", len(errors))
	}
}

func TestValidateBatch_AllInvalid(t *testing.T) {
	invalid := domain.Event{
		MessageID:   "bad",
		EventName:   "",
		Type:        "track",
		AnonymousID: "anon-1",
		ClientTS:    time.Now(),
	}
	valid, errors := ValidateBatch([]domain.Event{invalid})

	if len(valid) != 0 {
		t.Errorf("expected 0 valid, got %d", len(valid))
	}
	if len(errors) != 1 {
		t.Errorf("expected 1 error, got %d", len(errors))
	}
}
