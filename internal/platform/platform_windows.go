//go:build windows

package platform

import (
	"os/exec"
	"strings"
	"syscall"
)

func hide(cmd *exec.Cmd) {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.HideWindow = true
	cmd.SysProcAttr.CreationFlags |= 0x08000000
}

func OpenExternal(url string) error {
	cmd := exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", url)
	hide(cmd)
	return cmd.Start()
}

func OpenInExplorer(path string) error {
	cmd := exec.Command("explorer.exe", strings.ReplaceAll(path, "/", "\\"))
	hide(cmd)
	return cmd.Start()
}
