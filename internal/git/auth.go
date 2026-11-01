package git

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	goruntime "runtime"
	"strings"
	"time"

	"github.com/felixgugu/puffgittt/internal/model"
)

// ParseRemoteURL extracts the protocol, host and optional username from a Git
// remote URL. Both URL form (https://, ssh://) and scp-like form
// (git@host:path) are supported.
func ParseRemoteURL(raw string) (protocol, host, username string) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", "", ""
	}
	if strings.Contains(raw, "://") {
		parsed, err := url.Parse(raw)
		if err != nil {
			return "", "", ""
		}
		protocol = strings.ToLower(parsed.Scheme)
		host = parsed.Hostname()
		if parsed.User != nil {
			username = parsed.User.Username()
		}
		return protocol, host, username
	}
	// scp-like syntax: [user@]host:path
	idx := strings.Index(raw, ":")
	if idx < 0 {
		return "", "", ""
	}
	left := raw[:idx]
	if strings.ContainsAny(left, "/\\") {
		return "", "", ""
	}
	if at := strings.LastIndex(left, "@"); at >= 0 {
		username = left[:at]
		left = left[at+1:]
	}
	return "ssh", left, username
}

func (r *Runner) RemoteURL(ctx context.Context, root, remote string) (string, error) {
	remote = strings.TrimSpace(remote)
	if remote == "" {
		return "", fmt.Errorf("remote 不可為空")
	}
	out, errOut, err := r.RunBytes(ctx, root, nil, "remote", "get-url", remote)
	if err != nil {
		return "", r.OutputError(out, errOut, err)
	}
	return strings.TrimSpace(out), nil
}

func (r *Runner) credentialHelper(ctx context.Context, root string) string {
	out, _, err := r.RunBytes(ctx, root, nil, "config", "--get-all", "credential.helper")
	if err != nil {
		return ""
	}
	var helpers []string
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line != "" {
			helpers = append(helpers, line)
		}
	}
	return strings.Join(helpers, ", ")
}

func credentialInput(protocol, host, username, password string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "protocol=%s\n", protocol)
	fmt.Fprintf(&b, "host=%s\n", host)
	if username != "" {
		fmt.Fprintf(&b, "username=%s\n", username)
	}
	if password != "" {
		fmt.Fprintf(&b, "password=%s\n", password)
	}
	b.WriteString("\n")
	return b.String()
}

// credentialStored asks the configured credential helpers for an existing
// credential without allowing an interactive prompt.
func (r *Runner) credentialStored(ctx context.Context, protocol, host, username string) bool {
	if protocol != "https" && protocol != "http" {
		return false
	}
	ctx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	input := credentialInput(protocol, host, username, "")
	out, _, err := r.RunBytesEnv(ctx, "", []byte(input), []string{"GCM_INTERACTIVE=never"}, "credential", "fill")
	if err != nil {
		return false
	}
	for _, line := range strings.Split(out, "\n") {
		if strings.HasPrefix(line, "password=") && strings.TrimSpace(strings.TrimPrefix(line, "password=")) != "" {
			return true
		}
	}
	return false
}

func (r *Runner) SSHKeys() model.SSHKeyList {
	result := model.SSHKeyList{}
	if home, err := os.UserHomeDir(); err == nil && home != "" {
		sshDir := filepath.Join(home, ".ssh")
		result.KnownHosts = filepath.Join(sshDir, "known_hosts")
		for _, name := range []string{"id_ed25519", "id_ecdsa", "id_rsa", "id_dsa"} {
			privatePath := filepath.Join(sshDir, name)
			info, err := os.Stat(privatePath)
			if err != nil || info.IsDir() {
				continue
			}
			publicPath := privatePath + ".pub"
			_, pubErr := os.Stat(publicPath)
			result.Keys = append(result.Keys, model.SSHKeyInfo{
				Path:      privatePath,
				Type:      name,
				HasPublic: pubErr == nil,
			})
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, r.sshTool("ssh-add"), "-l")
	hideWindow(cmd)
	out, err := cmd.Output()
	if err == nil {
		result.AgentRunning = true
		for _, line := range strings.Split(string(out), "\n") {
			if strings.TrimSpace(line) != "" && !strings.HasPrefix(line, "The agent has no identities") {
				result.AgentKeys++
			}
		}
	}
	return result
}

func (r *Runner) RemoteAuthStatus(ctx context.Context, root, remote string) (model.RemoteAuthStatus, error) {
	rawURL, err := r.RemoteURL(ctx, root, remote)
	if err != nil {
		return model.RemoteAuthStatus{}, err
	}
	protocol, host, username := ParseRemoteURL(rawURL)
	status := model.RemoteAuthStatus{
		Remote:       remote,
		URL:          rawURL,
		Protocol:     protocol,
		Host:         host,
		Username:     username,
		HostKeyKnown: knownHostEntry(host),
	}
	status.CredentialHelper = r.credentialHelper(ctx, root)
	status.SSHKeyFound = len(r.SSHKeys().Keys) > 0
	if protocol == "https" || protocol == "http" {
		status.HasCredential = r.credentialStored(ctx, protocol, host, username)
	}
	return status, nil
}

func classifyRemoteError(text string) (auth, hostKey bool) {
	lower := strings.ToLower(text)
	authMarkers := []string{
		"authentication failed",
		"could not read username",
		"could not read password",
		"terminal prompts disabled",
		"permission denied (publickey",
		"permission denied, please try again",
		"invalid username or password",
		"access denied",
		"http 401",
		"http 403",
		"error: 401",
		"error: 403",
		"returned error: 401",
		"returned error: 403",
		"support for password authentication was removed",
	}
	for _, marker := range authMarkers {
		if strings.Contains(lower, marker) {
			auth = true
			break
		}
	}
	hostKeyMarkers := []string{
		"host key verification failed",
		"remote host identification has changed",
		"no rsa host key is known",
		"no ed25519 host key is known",
		"no ecdsa host key is known",
		"authenticity of host",
		"offending rsa key",
		"offending ed25519 key",
		"offending ecdsa key",
	}
	for _, marker := range hostKeyMarkers {
		if strings.Contains(lower, marker) {
			hostKey = true
			break
		}
	}
	return auth, hostKey
}

// TestRemote runs `git ls-remote` and classifies authentication failures so the
// UI can offer a credential or host-key dialog.
func (r *Runner) TestRemote(ctx context.Context, root, remote string) model.RemoteTestResult {
	rawURL, err := r.RemoteURL(ctx, root, remote)
	if err != nil {
		return model.RemoteTestResult{Message: err.Error()}
	}
	protocol, host, _ := ParseRemoteURL(rawURL)
	result := model.RemoteTestResult{Host: host, Protocol: protocol}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	out, errOut, err := r.RunBytesEnv(ctx, root, nil, []string{"GCM_INTERACTIVE=never", "GIT_ASKPASS="}, "ls-remote", "--heads", remote)
	if err == nil {
		count := 0
		for _, line := range strings.Split(out, "\n") {
			if strings.TrimSpace(line) != "" {
				count++
			}
		}
		result.OK = true
		result.Message = fmt.Sprintf("連線成功，讀取到 %d 個 remote branch", count)
		return result
	}

	detail := strings.TrimSpace(errOut)
	if detail == "" {
		detail = strings.TrimSpace(out)
	}
	if detail == "" {
		detail = err.Error()
	}
	result.AuthRequired, result.HostKeyRequired = classifyRemoteError(detail)
	if result.HostKeyRequired {
		result.Message = "SSH host key 尚未信任，請確認 fingerprint 後加入 known_hosts。\n" + detail
	} else if result.AuthRequired {
		result.Message = "需要遠端認證，請輸入帳號與 Personal Access Token。\n" + detail
	} else {
		result.Message = detail
	}
	return result
}

// SaveRemoteCredential validates HTTPS credentials and optionally stores them
// in the system credential helper. Credentials are passed through stdin only.
func (r *Runner) SaveRemoteCredential(ctx context.Context, root, remote, username, password string, remember bool) model.RemoteTestResult {
	rawURL, err := r.RemoteURL(ctx, root, remote)
	if err != nil {
		return model.RemoteTestResult{Message: err.Error()}
	}
	protocol, host, urlUser := ParseRemoteURL(rawURL)
	result := model.RemoteTestResult{Host: host, Protocol: protocol}
	if protocol != "https" && protocol != "http" {
		result.Message = "只有 HTTPS remote 可以使用帳號 / Token 認證；SSH remote 請改用 SSH key。"
		return result
	}
	if username == "" {
		username = urlUser
	}
	if username == "" {
		username = "x-access-token"
	}
	if strings.TrimSpace(password) == "" {
		result.Message = "請輸入 Personal Access Token。"
		result.AuthRequired = true
		return result
	}

	dir, err := os.MkdirTemp("", "puffgittt-cred-")
	if err != nil {
		result.Message = err.Error()
		return result
	}
	defer os.RemoveAll(dir)
	file := filepath.Join(dir, "credentials")
	oneShot := r.WithCredentialFile(file)
	input := credentialInput(protocol, host, username, password)
	if _, _, err := oneShot.RunBytesEnv(ctx, "", []byte(input), nil, "credential", "approve"); err != nil {
		result.Message = "無法寫入暫存憑證：" + err.Error()
		return result
	}

	result = oneShot.testRemoteWithURL(ctx, root, remote, rawURL)
	if !result.OK {
		return result
	}
	if remember {
		if err := r.approveSystemCredential(ctx, protocol, host, username, password); err != nil {
			result.Message += "\n提醒：憑證驗證成功，但寫入系統 credential helper 失敗：" + err.Error()
		} else {
			result.Message += "\n已儲存到系統 credential helper。"
		}
	}
	return result
}

func (r *Runner) testRemoteWithURL(ctx context.Context, root, remote, rawURL string) model.RemoteTestResult {
	protocol, host, _ := ParseRemoteURL(rawURL)
	result := model.RemoteTestResult{Host: host, Protocol: protocol}
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	out, errOut, err := r.RunBytesEnv(ctx, root, nil, []string{"GCM_INTERACTIVE=never", "GIT_ASKPASS="}, "ls-remote", "--heads", remote)
	if err == nil {
		count := 0
		for _, line := range strings.Split(out, "\n") {
			if strings.TrimSpace(line) != "" {
				count++
			}
		}
		result.OK = true
		result.Message = fmt.Sprintf("認證成功，讀取到 %d 個 remote branch", count)
		return result
	}
	detail := strings.TrimSpace(errOut)
	if detail == "" {
		detail = strings.TrimSpace(out)
	}
	if detail == "" {
		detail = err.Error()
	}
	result.AuthRequired, result.HostKeyRequired = classifyRemoteError(detail)
	result.Message = "認證失敗：" + detail
	return result
}

func (r *Runner) approveSystemCredential(ctx context.Context, protocol, host, username, password string) error {
	plain := &Runner{GitPath: r.GitPath}
	input := credentialInput(protocol, host, username, password)
	_, _, err := plain.RunBytesEnv(ctx, "", []byte(input), []string{"GCM_INTERACTIVE=never"}, "credential", "approve")
	return err
}

func (r *Runner) ForgetRemoteCredential(ctx context.Context, root, remote string) (model.OperationResult, error) {
	rawURL, err := r.RemoteURL(ctx, root, remote)
	if err != nil {
		return model.OperationResult{}, err
	}
	protocol, host, username := ParseRemoteURL(rawURL)
	if protocol != "https" && protocol != "http" {
		return model.OperationResult{Success: true, Message: "SSH remote 不使用 credential helper。"}, nil
	}
	plain := &Runner{GitPath: r.GitPath}
	input := credentialInput(protocol, host, username, "")
	if _, _, err := plain.RunBytesEnv(ctx, "", []byte(input), []string{"GCM_INTERACTIVE=never"}, "credential", "reject"); err != nil {
		return model.OperationResult{}, err
	}
	return model.OperationResult{Success: true, Message: "已移除儲存的遠端憑證。"}, nil
}

func (r *Runner) sshTool(name string) string {
	if path := gitBundledSSHTool(r.GitPath, name); path != "" {
		return path
	}
	if path, err := exec.LookPath(name); err == nil && path != "" {
		return path
	}
	if goruntime.GOOS == "windows" {
		root := os.Getenv("SystemRoot")
		if root == "" {
			root = `C:\Windows`
		}
		candidate := filepath.Join(root, "System32", "OpenSSH", name+".exe")
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return name
}

// gitBundledSSHTool prefers the OpenSSH shipped with Git for Windows. The
// Windows System32 ssh-keyscan can fail against hosts that negotiate modern
// KEX algorithms (for example github.com).
func gitBundledSSHTool(gitPath, name string) string {
	gitPath = strings.TrimSpace(gitPath)
	if gitPath == "" {
		return ""
	}
	dir := filepath.Dir(gitPath)
	if dir == "." || dir == "" {
		return ""
	}
	roots := []string{filepath.Dir(dir), dir}
	candidates := make([]string, 0, 6)
	for _, root := range roots {
		candidates = append(candidates,
			filepath.Join(root, "usr", "bin", name+".exe"),
			filepath.Join(root, "bin", name+".exe"),
			filepath.Join(root, "mingw64", "usr", "bin", name+".exe"),
		)
	}
	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate
		}
	}
	return ""
}

func (r *Runner) sshFingerprint(keyLine string) string {
	dir, err := os.MkdirTemp("", "puffgittt-ssh-")
	if err != nil {
		return ""
	}
	defer os.RemoveAll(dir)
	file := filepath.Join(dir, "host.pub")
	if err := os.WriteFile(file, []byte(keyLine+"\n"), 0o600); err != nil {
		return ""
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, r.sshTool("ssh-keygen"), "-lf", file)
	hideWindow(cmd)
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	fields := strings.Fields(string(out))
	if len(fields) >= 2 {
		return fields[1]
	}
	return strings.TrimSpace(string(out))
}

// SSHHostKeys scans a host and returns the offered host keys with fingerprints.
func (r *Runner) SSHHostKeys(ctx context.Context, host string) ([]model.SSHHostKey, error) {
	host = strings.TrimSpace(host)
	if host == "" {
		return nil, fmt.Errorf("host 不可為空")
	}
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, r.sshTool("ssh-keyscan"), "-T", "10", "-t", "rsa,ecdsa,ed25519", host)
	hideWindow(cmd)
	out, err := cmd.Output()
	if err != nil && len(out) == 0 {
		return nil, fmt.Errorf("無法讀取 %s 的 host key：%v", host, err)
	}

	seen := map[string]bool{}
	var keys []model.SSHHostKey
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}
		algorithm := fields[1]
		if seen[algorithm] {
			continue
		}
		seen[algorithm] = true
		keyLine := fields[0] + " " + fields[1] + " " + fields[2]
		keys = append(keys, model.SSHHostKey{
			Host:        fields[0],
			Algorithm:   algorithm,
			Fingerprint: r.sshFingerprint(keyLine),
			Key:         keyLine,
		})
	}
	if len(keys) == 0 {
		return nil, fmt.Errorf("%s 沒有回傳任何 host key", host)
	}
	return keys, nil
}

// TrustHostKey appends a scanned host key to ~/.ssh/known_hosts, replacing any
// conflicting entry for the same host.
func (r *Runner) TrustHostKey(ctx context.Context, keyLine string) (model.OperationResult, error) {
	fields := strings.Fields(strings.TrimSpace(keyLine))
	if len(fields) < 3 {
		return model.OperationResult{}, fmt.Errorf("host key 格式不正確")
	}
	hostPattern := fields[0]
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return model.OperationResult{}, fmt.Errorf("無法取得使用者家目錄")
	}
	sshDir := filepath.Join(home, ".ssh")
	if err := os.MkdirAll(sshDir, 0o700); err != nil {
		return model.OperationResult{}, err
	}
	knownHosts := filepath.Join(sshDir, "known_hosts")

	removeCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	remove := exec.CommandContext(removeCtx, r.sshTool("ssh-keygen"), "-R", hostPattern, "-f", knownHosts)
	hideWindow(remove)
	_ = remove.Run()

	file, err := os.OpenFile(knownHosts, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return model.OperationResult{}, err
	}
	defer file.Close()
	if _, err := file.WriteString(strings.TrimSpace(keyLine) + "\n"); err != nil {
		return model.OperationResult{}, err
	}
	return model.OperationResult{Success: true, Message: "已將 host key 加入 known_hosts。"}, nil
}

func knownHostEntry(host string) bool {
	host = strings.ToLower(strings.TrimSpace(host))
	if host == "" {
		return false
	}
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return false
	}
	data, err := os.ReadFile(filepath.Join(home, ".ssh", "known_hosts"))
	if err != nil {
		return false
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}
		for _, pattern := range strings.Split(fields[0], ",") {
			pattern = strings.ToLower(strings.TrimPrefix(pattern, "["))
			pattern = strings.TrimSuffix(pattern, "]")
			if colon := strings.Index(pattern, "]:"); colon >= 0 {
				pattern = pattern[:colon]
			}
			if pattern == host {
				return true
			}
		}
	}
	return false
}
