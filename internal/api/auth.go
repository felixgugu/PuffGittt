package api

import "github.com/felixgugu/puffgittt/internal/model"

type RemoteAuthAPI struct {
	s *Service
}

func NewRemoteAuthAPI(s *Service) *RemoteAuthAPI { return &RemoteAuthAPI{s: s} }

// Status reports the remote URL, protocol, stored credential and SSH state.
func (a *RemoteAuthAPI) Status(root, remote string) (model.RemoteAuthStatus, error) {
	return a.s.runnerWithSettings().RemoteAuthStatus(a.s.context(), root, remote)
}

// Test runs `git ls-remote` and classifies authentication / host-key failures.
func (a *RemoteAuthAPI) Test(root, remote string) model.RemoteTestResult {
	return a.s.runnerWithSettings().TestRemote(a.s.context(), root, remote)
}

// Save validates HTTPS credentials and optionally stores them in the system
// credential helper. The token is passed through stdin, never argv.
func (a *RemoteAuthAPI) Save(root, remote, username, password string, remember bool) model.RemoteTestResult {
	return a.s.runnerWithSettings().SaveRemoteCredential(a.s.context(), root, remote, username, password, remember)
}

// Forget removes a stored HTTPS credential from the system helper.
func (a *RemoteAuthAPI) Forget(root, remote string) (model.OperationResult, error) {
	return a.s.runnerWithSettings().ForgetRemoteCredential(a.s.context(), root, remote)
}

// SSHKeys lists local SSH keys and agent identity count.
func (a *RemoteAuthAPI) SSHKeys() model.SSHKeyList {
	return a.s.runnerWithSettings().SSHKeys()
}

// SSHHostKeys scans a host for its offered host keys and fingerprints.
func (a *RemoteAuthAPI) SSHHostKeys(host string) ([]model.SSHHostKey, error) {
	return a.s.runnerWithSettings().SSHHostKeys(a.s.context(), host)
}

// TrustHost appends a scanned host key to ~/.ssh/known_hosts.
func (a *RemoteAuthAPI) TrustHost(key string) (model.OperationResult, error) {
	return a.s.runnerWithSettings().TrustHostKey(a.s.context(), key)
}
