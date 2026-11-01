package api

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync/atomic"
	"time"

	"github.com/felixgugu/puffgittt/internal/model"
)

var undoSequence atomic.Uint64

func nextUndoID() string {
	return fmt.Sprintf("undo-%d-%d", time.Now().UnixNano(), undoSequence.Add(1))
}

func (s *Service) loadUndoFile() {
	if s.undoFile == "" {
		return
	}
	data, err := os.ReadFile(s.undoFile)
	if err != nil {
		return
	}
	var records map[string][]model.UndoRecord
	if err := json.Unmarshal(data, &records); err != nil || records == nil {
		return
	}
	for key, entries := range records {
		for index := range entries {
			if entries[index].ID == "" {
				entries[index].ID = nextUndoID()
			}
		}
		records[key] = entries
	}
	s.undoMu.Lock()
	s.undo = records
	s.undoMu.Unlock()
}

func (s *Service) persistUndoLocked() {
	if s.undoFile == "" {
		return
	}
	data, err := json.MarshalIndent(s.undo, "", "  ")
	if err != nil {
		return
	}
	if err := os.MkdirAll(filepath.Dir(s.undoFile), 0o755); err != nil {
		return
	}
	tmp := s.undoFile + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return
	}
	_ = os.Rename(tmp, s.undoFile)
}
