package git

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

type Runner struct {
	GitPath string
}

func NewRunner() *Runner {
	path, err := exec.LookPath("git")
	if err != nil || path == "" {
		path = "git"
	}
	return &Runner{GitPath: path}
}

func (r *Runner) WithPath(path string) *Runner {
	if strings.TrimSpace(path) == "" {
		return r
	}
	return &Runner{GitPath: path}
}

type CommandError struct {
	Args   []string
	Code   int
	Stdout string
	Stderr string
	Err    error
}

func (e *CommandError) Error() string {
	detail := strings.TrimSpace(e.Stderr)
	if detail == "" {
		detail = strings.TrimSpace(e.Stdout)
	}
	if detail == "" {
		detail = e.Err.Error()
	}
	return detail
}

func (e *CommandError) Unwrap() error { return e.Err }

func (r *Runner) command(ctx context.Context, dir string, args ...string) *exec.Cmd {
	if ctx == nil {
		ctx = context.Background()
	}
	cmd := exec.CommandContext(ctx, r.GitPath, args...)
	if dir != "" {
		cmd.Dir = dir
	}
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
	hideWindow(cmd)
	return cmd
}

func (r *Runner) Run(ctx context.Context, dir string, args ...string) (string, error) {
	out, _, err := r.RunBytes(ctx, dir, nil, args...)
	return out, err
}

func (r *Runner) RunInput(ctx context.Context, dir string, input []byte, args ...string) (string, error) {
	out, _, err := r.RunBytes(ctx, dir, input, args...)
	return out, err
}

func (r *Runner) RunBytes(ctx context.Context, dir string, input []byte, args ...string) (string, string, error) {
	return r.RunBytesEnv(ctx, dir, input, nil, args...)
}

func (r *Runner) RunBytesEnv(ctx context.Context, dir string, input []byte, env []string, args ...string) (string, string, error) {
	cmd := r.command(ctx, dir, args...)
	if len(env) > 0 {
		cmd.Env = append(cmd.Env, env...)
	}
	if input != nil {
		cmd.Stdin = bytes.NewReader(input)
	}
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	out := stdout.String()
	errOut := stderr.String()
	if err != nil {
		code := -1
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			code = exitErr.ExitCode()
		}
		return out, errOut, &CommandError{Args: args, Code: code, Stdout: out, Stderr: errOut, Err: err}
	}
	return out, errOut, nil
}

func (r *Runner) RunWithTimeout(dir string, timeout time.Duration, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	return r.Run(ctx, dir, args...)
}

func (r *Runner) Version(ctx context.Context) (string, error) {
	out, err := r.Run(ctx, "", "--version")
	return strings.TrimSpace(out), err
}

func (r *Runner) OutputError(out, errOut string, err error) error {
	if err == nil {
		return nil
	}
	detail := strings.TrimSpace(errOut)
	if detail == "" {
		detail = strings.TrimSpace(out)
	}
	if detail == "" {
		detail = err.Error()
	}
	return fmt.Errorf("%s", detail)
}
