package domain

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestEvent_Validate(t *testing.T) {
	validEvent := func() Event {
		return Event{
			MessageID:   "msg-1",
			EventName:   "button_clicked",
			Type:        "track",
			Properties:  json.RawMessage(`{}`),
			Context:     json.RawMessage(`{}`),
			AnonymousID: "anon-1",
			ClientTS:    time.Now(),
		}
	}

	tests := []struct {
		name    string
		modify  func(e *Event)
		wantErr string
	}{
		{
			name:   "valid event",
			modify: func(e *Event) {},
		},
		{
			name:    "empty event name",
			modify:  func(e *Event) { e.EventName = "" },
			wantErr: "event name is required",
		},
		{
			name:    "event name too long",
			modify:  func(e *Event) { e.EventName = strings.Repeat("a", 257) },
			wantErr: "exceeds 256 character limit",
		},
		{
			name:    "event name with spaces",
			modify:  func(e *Event) { e.EventName = "has spaces" },
			wantErr: "alphanumeric",
		},
		{
			name:    "event name with dashes",
			modify:  func(e *Event) { e.EventName = "has-dashes" },
			wantErr: "alphanumeric",
		},
		{
			name:   "event name with dollar sign",
			modify: func(e *Event) { e.EventName = "$screen" },
		},
		{
			name:   "event name with underscores",
			modify: func(e *Event) { e.EventName = "button_clicked" },
		},
		{
			name:    "invalid type",
			modify:  func(e *Event) { e.Type = "invalid" },
			wantErr: "type must be one of",
		},
		{
			name:   "type track",
			modify: func(e *Event) { e.Type = "track" },
		},
		{
			name:   "type screen",
			modify: func(e *Event) { e.Type = "screen" },
		},
		{
			name:   "type identify",
			modify: func(e *Event) { e.Type = "identify" },
		},
		{
			name:    "empty anonymous ID",
			modify:  func(e *Event) { e.AnonymousID = "" },
			wantErr: "anonymousId is required",
		},
		{
			name:    "empty message ID",
			modify:  func(e *Event) { e.MessageID = "" },
			wantErr: "messageId is required",
		},
		{
			name:    "zero timestamp",
			modify:  func(e *Event) { e.ClientTS = time.Time{} },
			wantErr: "timestamp is required",
		},
		{
			name:    "invalid properties (not an object)",
			modify:  func(e *Event) { e.Properties = json.RawMessage(`"string"`) },
			wantErr: "properties must be a JSON object",
		},
		{
			name: "too many properties",
			modify: func(e *Event) {
				props := make(map[string]string)
				for i := 0; i < 257; i++ {
					props[strings.Repeat("k", 3)+string(rune('a'+i%26))+strings.Repeat("x", i)] = "v"
				}
				b, _ := json.Marshal(props)
				e.Properties = b
			},
			wantErr: "too many properties",
		},
		{
			name:   "null properties",
			modify: func(e *Event) { e.Properties = json.RawMessage(`null`) },
		},
		{
			name:   "empty properties",
			modify: func(e *Event) { e.Properties = json.RawMessage(`{}`) },
		},
		{
			name: "property key too long",
			modify: func(e *Event) {
				longKey := strings.Repeat("k", 257)
				e.Properties = json.RawMessage(`{"` + longKey + `":"value"}`)
			},
			wantErr: "exceeds 256 character limit",
		},
		{
			name: "property value too large",
			modify: func(e *Event) {
				largeValue := strings.Repeat("x", 9000)
				e.Properties = json.RawMessage(`{"key":"` + largeValue + `"}`)
			},
			wantErr: "exceeds 8192 byte limit",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := validEvent()
			tt.modify(&e)

			err := e.Validate()

			if tt.wantErr == "" {
				if err != nil {
					t.Errorf("expected no error, got: %v", err)
				}
				return
			}

			if err == nil {
				t.Fatalf("expected error containing %q, got nil", tt.wantErr)
			}
			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Errorf("expected error containing %q, got: %v", tt.wantErr, err)
			}
		})
	}
}
