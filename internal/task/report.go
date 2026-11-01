package task

import "context"

type reporterKey struct{}

// WithReporter attaches a progress reporter to the task context. Git commands
// use Report to surface progress lines without knowing about the task manager.
func WithReporter(ctx context.Context, report func(string)) context.Context {
	return context.WithValue(ctx, reporterKey{}, report)
}

func Report(ctx context.Context, message string) {
	if ctx == nil {
		return
	}
	report, ok := ctx.Value(reporterKey{}).(func(string))
	if ok && report != nil {
		report(message)
	}
}
