//go:build !windows

package platform

import (
	"os/exec"
	"runtime"
)

func OpenExternal(url string) error {
	var cmd *exec.Cmd
	if runtime.GOOS == "darwin" {
		cmd = exec.Command("open", url)
	} else {
		cmd = exec.Command("xdg-open", url)
	}
	return cmd.Start()
}

func OpenInExplorer(path string) error {
	var cmd *exec.Cmd
	if runtime.GOOS == "darwin" {
		cmd = exec.Command("open", path)
	} else {
		cmd = exec.Command("xdg-open", path)
	}
	return cmd.Start()
}
