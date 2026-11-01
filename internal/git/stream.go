package git

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"io"
	"os/exec"
	"strings"
	"sync"

	"github.com/felixgugu/puffgittt/internal/task"
)

// RunTask is RunBytes with streaming progress lines. It is used for long
// operations so the task manager can surface Git output while the command runs.
func (r *Runner) RunTask(ctx context.Context, dir string, input []byte, args ...string) (string, string, error) {
	return r.RunTaskEnv(ctx, dir, input, nil, args...)
}

func (r *Runner) RunTaskEnv(ctx context.Context, dir string, input []byte, env []string, args ...string) (string, string, error) {
	cmd := r.command(ctx, dir, args...)
	if len(env) > 0 {
		cmd.Env = append(cmd.Env, env...)
	}
	if input != nil {
		cmd.Stdin = bytes.NewReader(input)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "", "", &CommandError{Args: args, Code: -1, Err: err}
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return "", "", &CommandError{Args: args, Code: -1, Err: err}
	}
	if err := cmd.Start(); err != nil {
		return "", "", &CommandError{Args: args, Code: -1, Err: err}
	}

	var outBuf, errBuf bytes.Buffer
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		collectOutput(ctx, stdout, &outBuf)
	}()
	go func() {
		defer wg.Done()
		collectOutput(ctx, stderr, &errBuf)
	}()

	err = cmd.Wait()
	wg.Wait()
	out := outBuf.String()
	errOut := errBuf.String()
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

func collectOutput(ctx context.Context, reader io.Reader, buffer *bytes.Buffer) {
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		buffer.WriteString(line)
		buffer.WriteByte('\n')
		for _, part := range strings.Split(line, "\r") {
			part = strings.TrimSpace(part)
			if part != "" {
				task.Report(ctx, part)
			}
		}
	}
}
