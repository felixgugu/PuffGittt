package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"

	"github.com/felixgugu/puffgittt/internal/api"
	"github.com/felixgugu/puffgittt/internal/config"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	cfg := config.Init()
	service := api.New(cfg)
	app := NewApp(service)

	appAPI := api.NewAppAPI(service)
	repoAPI := api.NewRepoAPI(service)
	changeAPI := api.NewChangeAPI(service)
	commitAPI := api.NewCommitAPI(service)
	historyAPI := api.NewHistoryAPI(service)
	branchAPI := api.NewBranchAPI(service)
	syncAPI := api.NewSyncAPI(service)
	conflictAPI := api.NewConflictAPI(service)
	stashAPI := api.NewStashAPI(service)
	tagAPI := api.NewTagAPI(service)

	err := wails.Run(&options.App{
		Title:            "PuffGittt",
		Width:            1440,
		Height:           900,
		MinWidth:         1024,
		MinHeight:        680,
		Frameless:        true,
		WindowStartState: options.Maximised,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 0, G: 0, B: 0, A: 0},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
			appAPI,
			repoAPI,
			changeAPI,
			commitAPI,
			historyAPI,
			branchAPI,
			syncAPI,
			conflictAPI,
			stashAPI,
			tagAPI,
		},
		Windows: &windows.Options{
			BackdropType:         windows.Mica,
			WebviewIsTransparent: true,
			WindowIsTranslucent:  true,
			Theme:                windows.SystemDefault,
			ResizeDebounceMS:     50,
			IsZoomControlEnabled: false,
		},
	})
	if err != nil {
		log.Fatal(err)
	}
}
