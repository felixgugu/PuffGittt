package config

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/felixgugu/puffgittt/internal/model"
)

type Config struct {
	AppDir      string
	SettingsDir string
	CacheDir    string
	LogDir      string
	BackupDir   string
	mu          sync.Mutex
}

func Init() *Config {
	base, err := os.UserConfigDir()
	if err != nil || base == "" {
		base = os.TempDir()
	}
	cache, err := os.UserCacheDir()
	if err != nil || cache == "" {
		cache = os.TempDir()
	}
	cfg := &Config{
		AppDir:      filepath.Join(base, "PuffGittt"),
		SettingsDir: filepath.Join(base, "PuffGittt"),
		CacheDir:    filepath.Join(cache, "PuffGittt", "cache"),
		LogDir:      filepath.Join(cache, "PuffGittt", "logs"),
		BackupDir:   filepath.Join(cache, "PuffGittt", "backups"),
	}
	for _, dir := range []string{cfg.AppDir, cfg.CacheDir, cfg.LogDir, cfg.BackupDir} {
		_ = os.MkdirAll(dir, 0o755)
	}
	return cfg
}

func (c *Config) SettingsPath() string {
	return filepath.Join(c.SettingsDir, "settings.json")
}

func (c *Config) DraftDir() string {
	return filepath.Join(c.SettingsDir, "drafts")
}

func (c *Config) LoadSettings() model.Settings {
	c.mu.Lock()
	defer c.mu.Unlock()

	settings := model.Settings{
		Theme:    "system",
		Language: "zh-TW",
	}
	data, err := os.ReadFile(c.SettingsPath())
	if err != nil {
		return settings
	}
	if err := json.Unmarshal(data, &settings); err != nil {
		return model.Settings{Theme: "system", Language: "zh-TW"}
	}
	if settings.Theme == "" {
		settings.Theme = "system"
	}
	if settings.Language == "" {
		settings.Language = "zh-TW"
	}
	if settings.Recent == nil {
		settings.Recent = []model.RecentRepo{}
	}
	return settings
}

func (c *Config) SaveSettings(settings model.Settings) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if settings.Theme == "" {
		settings.Theme = "system"
	}
	if settings.Language == "" {
		settings.Language = "zh-TW"
	}
	if settings.Recent == nil {
		settings.Recent = []model.RecentRepo{}
	}
	sort.SliceStable(settings.Recent, func(i, j int) bool {
		return settings.Recent[i].LastOpened > settings.Recent[j].LastOpened
	})
	if len(settings.Recent) > 20 {
		settings.Recent = settings.Recent[:20]
	}

	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	path := c.SettingsPath()
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func (c *Config) TouchRecent(path, name string) model.Settings {
	settings := c.LoadSettings()
	now := time.Now().UTC().Format(time.RFC3339)
	found := false
	for i := range settings.Recent {
		if samePath(settings.Recent[i].Path, path) {
			settings.Recent[i].Name = name
			settings.Recent[i].LastOpened = now
			found = true
			break
		}
	}
	if !found {
		settings.Recent = append(settings.Recent, model.RecentRepo{Path: path, Name: name, LastOpened: now})
	}
	_ = c.SaveSettings(settings)
	return settings
}

func (c *Config) RemoveRecent(path string) error {
	settings := c.LoadSettings()
	out := settings.Recent[:0]
	for _, entry := range settings.Recent {
		if !samePath(entry.Path, path) {
			out = append(out, entry)
		}
	}
	settings.Recent = out
	return c.SaveSettings(settings)
}

func samePath(a, b string) bool {
	aa, errA := filepath.Abs(a)
	bb, errB := filepath.Abs(b)
	if errA != nil || errB != nil {
		return a == b
	}
	return filepath.Clean(aa) == filepath.Clean(bb)
}

var ErrNotFound = errors.New("not found")
