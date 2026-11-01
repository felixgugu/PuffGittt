//go:build windows

package platform

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

var (
	shell32           = syscall.NewLazyDLL("shell32.dll")
	procShellExecuteW = shell32.NewProc("ShellExecuteW")
)

const swShowNormal = 1

func shellExecute(verb, target string) error {
	verbPtr, err := syscall.UTF16PtrFromString(verb)
	if err != nil {
		return err
	}
	targetPtr, err := syscall.UTF16PtrFromString(target)
	if err != nil {
		return err
	}
	// hwnd 0 lets the shell decide the owner; the calling process is foreground
	// when this runs from a click handler, so the window is shown normally.
	ret, _, _ := procShellExecuteW.Call(
		0,
		uintptr(unsafe.Pointer(verbPtr)),
		uintptr(unsafe.Pointer(targetPtr)),
		0,
		0,
		swShowNormal,
	)
	if ret <= 32 {
		return fmt.Errorf("ShellExecuteW(%s, %q) 失敗：%s", verb, target, shellExecuteError(ret))
	}
	return nil
}

func shellExecuteError(code uintptr) string {
	switch code {
	case 0:
		return "系統記憶體不足"
	case 2:
		return "找不到檔案"
	case 3:
		return "找不到路徑"
	case 5:
		return "存取被拒絕"
	case 26:
		return "無法共用開啟的檔案"
	case 27:
		return "操作未完成"
	case 28:
		return "操作逾時"
	case 29:
		return "DDE 失敗"
	case 30:
		return "DDE 忙碌中"
	case 31:
		return "沒有可開啟此檔案的關聯程式"
	case 32:
		return "找不到 DLL"
	}
	return fmt.Sprintf("錯誤碼 %d", code)
}

func OpenExternal(url string) error {
	return shellExecute("open", url)
}

func OpenInExplorer(path string) error {
	path = strings.TrimSpace(path)
	if path == "" {
		return fmt.Errorf("路徑不可為空")
	}
	path = filepath.Clean(path)
	if !filepath.IsAbs(path) {
		if abs, err := filepath.Abs(path); err == nil {
			path = abs
		}
	}
	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("無法開啟檔案總管：%w", err)
	}
	if info.IsDir() {
		return shellExecute("open", path)
	}
	// Select the file inside an Explorer window instead of opening it.
	if err := exec.Command("explorer.exe", "/select,"+path).Start(); err == nil {
		return nil
	}
	return shellExecute("open", filepath.Dir(path))
}
