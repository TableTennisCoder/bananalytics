package storage

import "testing"

func floatPtr(v float64) *float64 { return &v }

func TestNewFunnelResultConversionRates(t *testing.T) {
	steps := []string{"signup_start", "signup_complete", "purchase"}
	counts := []int{200, 150, 30}
	medians := []*float64{nil, floatPtr(45), floatPtr(3600)}

	result := NewFunnelResult(steps, counts, medians)

	if len(result) != 3 {
		t.Fatalf("expected 3 steps, got %d", len(result))
	}

	// First step is always 100% of itself and has no previous step to measure.
	if result[0].ConversionRate != 100 || result[0].StepConversionRate != 100 {
		t.Errorf("step 1: expected 100%% conversion, got %.1f / %.1f",
			result[0].ConversionRate, result[0].StepConversionRate)
	}
	if result[0].Dropped != 0 {
		t.Errorf("step 1: expected no drop-off, got %d", result[0].Dropped)
	}
	if result[0].MedianSecondsFromPrev != nil {
		t.Error("step 1: expected no median time, there is no previous step")
	}

	if result[1].ConversionRate != 75 {
		t.Errorf("step 2: expected 75%% of the first step, got %.1f", result[1].ConversionRate)
	}
	if result[1].StepConversionRate != 75 {
		t.Errorf("step 2: expected 75%% of the previous step, got %.1f", result[1].StepConversionRate)
	}
	if result[1].Dropped != 50 {
		t.Errorf("step 2: expected 50 dropped, got %d", result[1].Dropped)
	}

	if result[2].ConversionRate != 15 {
		t.Errorf("step 3: expected 15%% of the first step, got %.1f", result[2].ConversionRate)
	}
	if result[2].StepConversionRate != 20 {
		t.Errorf("step 3: expected 20%% of the previous step, got %.1f", result[2].StepConversionRate)
	}
	if result[2].MedianSecondsFromPrev == nil || *result[2].MedianSecondsFromPrev != 3600 {
		t.Errorf("step 3: expected median of 3600s, got %v", result[2].MedianSecondsFromPrev)
	}
}

func TestNewFunnelResultEmptyFunnel(t *testing.T) {
	steps := []string{"a", "b"}
	result := NewFunnelResult(steps, []int{0, 0}, make([]*float64, 2))

	for i, step := range result {
		if step.ConversionRate != 0 || step.StepConversionRate != 0 {
			t.Errorf("step %d: expected 0%% when nobody entered the funnel, got %.1f / %.1f",
				i+1, step.ConversionRate, step.StepConversionRate)
		}
	}
}

func TestNewFunnelResultNeverExceedsPreviousStep(t *testing.T) {
	// An ordered funnel query cannot return more people on a later step, so
	// conversion must stay within 0-100% all the way down.
	steps := []string{"a", "b", "c", "d"}
	counts := []int{1000, 1000, 1, 0}

	for i, step := range NewFunnelResult(steps, counts, make([]*float64, 4)) {
		if step.ConversionRate < 0 || step.ConversionRate > 100 {
			t.Errorf("step %d: conversion rate out of range: %.1f", i+1, step.ConversionRate)
		}
		if step.StepConversionRate < 0 || step.StepConversionRate > 100 {
			t.Errorf("step %d: step conversion rate out of range: %.1f", i+1, step.StepConversionRate)
		}
		if step.Dropped < 0 {
			t.Errorf("step %d: negative drop-off: %d", i+1, step.Dropped)
		}
	}
}
