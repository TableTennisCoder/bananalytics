package storage

// NewFunnelResult turns raw per-step reach counts into a funnel result with
// conversion rates and drop-off filled in. counts[i] and medians[i] belong to
// steps[i]; medians[0] is ignored because there is no previous step to measure
// against. Counts are expected to be monotonically non-increasing — an ordered
// funnel query cannot produce more people on a later step.
func NewFunnelResult(steps []string, counts []int, medians []*float64) []FunnelStep {
	result := make([]FunnelStep, 0, len(steps))

	var firstCount int
	if len(counts) > 0 {
		firstCount = counts[0]
	}

	for i, step := range steps {
		count := counts[i]
		step := FunnelStep{
			Step:           step,
			Count:          count,
			ConversionRate: percentOf(count, firstCount),
		}

		if i == 0 {
			step.StepConversionRate = step.ConversionRate
		} else {
			step.Dropped = counts[i-1] - count
			step.StepConversionRate = percentOf(count, counts[i-1])
			step.MedianSecondsFromPrev = medians[i]
		}

		result = append(result, step)
	}

	return result
}

func percentOf(part, total int) float64 {
	if total <= 0 {
		return 0
	}
	return float64(part) / float64(total) * 100
}
