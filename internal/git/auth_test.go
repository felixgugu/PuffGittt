package git

import "testing"

func TestParseRemoteURL(t *testing.T) {
	cases := []struct {
		raw      string
		protocol string
		host     string
		username string
	}{
		{"https://github.com/felixgugu/PuffGittt.git", "https", "github.com", ""},
		{"https://token@github.com/owner/repo.git", "https", "github.com", "token"},
		{"http://git.example.com:8080/repo.git", "http", "git.example.com", ""},
		{"ssh://git@github.com:22/owner/repo.git", "ssh", "github.com", "git"},
		{"git@github.com:felixgugu/PuffGittt.git", "ssh", "github.com", "git"},
		{"github.com:owner/repo.git", "ssh", "github.com", ""},
		{"", "", "", ""},
	}
	for _, tc := range cases {
		protocol, host, username := ParseRemoteURL(tc.raw)
		if protocol != tc.protocol || host != tc.host || username != tc.username {
			t.Fatalf("ParseRemoteURL(%q) = (%q, %q, %q), want (%q, %q, %q)",
				tc.raw, protocol, host, username, tc.protocol, tc.host, tc.username)
		}
	}
}

func TestClassifyRemoteError(t *testing.T) {
	cases := []struct {
		text    string
		auth    bool
		hostKey bool
	}{
		{"fatal: could not read Username for 'https://github.com': terminal prompts disabled", true, false},
		{"remote: Invalid username or password.\nfatal: Authentication failed for 'https://github.com/x/y.git/'", true, false},
		{"git@github.com: Permission denied (publickey).", true, false},
		{"The requested URL returned error: 403", true, false},
		{"Host key verification failed.", false, true},
		{"@@@ WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED! @@@", false, true},
		{"fatal: unable to access 'https://github.com/x/y.git/': Could not resolve host: github.com", false, false},
	}
	for _, tc := range cases {
		auth, hostKey := classifyRemoteError(tc.text)
		if auth != tc.auth || hostKey != tc.hostKey {
			t.Fatalf("classifyRemoteError(%q) = (%v, %v), want (%v, %v)",
				tc.text, auth, hostKey, tc.auth, tc.hostKey)
		}
	}
}

func TestCredentialInput(t *testing.T) {
	got := credentialInput("https", "github.com", "octocat", "secret")
	want := "protocol=https\nhost=github.com\nusername=octocat\npassword=secret\n\n"
	if got != want {
		t.Fatalf("credentialInput = %q, want %q", got, want)
	}
}
