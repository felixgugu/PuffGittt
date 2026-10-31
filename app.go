package main

import (
	"context"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"github.com/felixgugu/puffgittt/internal/api"
)

type App struct {
	service *api.Service
	ctx     context.Context
}

func NewApp(service *api.Service) *App {
	return &App{service: service}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.service.SetContext(ctx)
}

func (a *App) shutdown(ctx context.Context) {}

func (a *App) SetTheme(mode string) {
	if a.ctx == nil {
		return
	}
	switch mode {
	case "dark":
		runtime.WindowSetDarkTheme(a.ctx)
	case "light":
		runtime.WindowSetLightTheme(a.ctx)
	default:
		runtime.WindowSetSystemDefaultTheme(a.ctx)
	}
}
