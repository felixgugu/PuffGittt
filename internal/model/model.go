package model

// Repository is the identity and current state of an opened repository.
type Repository struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	RootPath  string `json:"rootPath"`
	GitDir    string `json:"gitDir"`
	HeadOid   string `json:"headOid,omitempty"`
	Branch    string `json:"branch,omitempty"`
	Upstream  string `json:"upstream,omitempty"`
	Detached  bool   `json:"detached"`
	Unborn    bool   `json:"unborn"`
	Operation string `json:"operation"`
	Revision  int64  `json:"revision"`
}

type FileChange struct {
	ID             string `json:"id"`
	Path           string `json:"path"`
	OriginalPath   string `json:"originalPath,omitempty"`
	IndexStatus    string `json:"indexStatus"`
	WorktreeStatus string `json:"worktreeStatus"`
	Kind           string `json:"kind"`
	Binary         bool   `json:"binary,omitempty"`
}

type Status struct {
	Repo   Repository   `json:"repo"`
	Files  []FileChange `json:"files"`
	Ahead  int          `json:"ahead"`
	Behind int          `json:"behind"`
}

type DiffDocument struct {
	Path      string `json:"path"`
	Side      string `json:"side"`
	OldText   string `json:"oldText"`
	NewText   string `json:"newText"`
	Language  string `json:"language"`
	Binary    bool   `json:"binary"`
	Truncated bool   `json:"truncated"`
}

type Commit struct {
	Oid            string   `json:"oid"`
	Parents        []string `json:"parents"`
	Author         string   `json:"author"`
	AuthorEmail    string   `json:"authorEmail"`
	AuthorTime     string   `json:"authorTime"`
	Committer      string   `json:"committer"`
	CommitterEmail string   `json:"committerEmail"`
	CommitterTime  string   `json:"committerTime"`
	Subject        string   `json:"subject"`
	Message        string   `json:"message"`
	Refs           []string `json:"refs"`
}

type CommitFile struct {
	Path   string `json:"path"`
	Status string `json:"status"`
}

type CommitDetail struct {
	Commit Commit       `json:"commit"`
	Files  []CommitFile `json:"files"`
}

type Branch struct {
	Name          string `json:"name"`
	FullName      string `json:"fullName"`
	Kind          string `json:"kind"`
	Oid           string `json:"oid"`
	Upstream      string `json:"upstream,omitempty"`
	CommitterDate string `json:"committerDate"`
	Current       bool   `json:"current"`
	Merged        bool   `json:"merged"`
	Ahead         int    `json:"ahead"`
	Behind        int    `json:"behind"`
}

type Remote struct {
	Name     string `json:"name"`
	FetchURL string `json:"fetchUrl"`
	PushURL  string `json:"pushUrl"`
}

type ConflictStage struct {
	Stage   int    `json:"stage"`
	Oid     string `json:"oid,omitempty"`
	Exists  bool   `json:"exists"`
	Content string `json:"content,omitempty"`
	Binary  bool   `json:"binary,omitempty"`
}

type ConflictFile struct {
	Path    string          `json:"path"`
	Stages  []ConflictStage `json:"stages"`
	Binary  bool            `json:"binary"`
	Present bool            `json:"present"`
}

type ConflictVersions struct {
	Path        string `json:"path"`
	Base        string `json:"base"`
	Ours        string `json:"ours"`
	Theirs      string `json:"theirs"`
	Result      string `json:"result"`
	OursLabel   string `json:"oursLabel"`
	TheirsLabel string `json:"theirsLabel"`
	Binary      bool   `json:"binary"`
	Operation   string `json:"operation"`
}

type StashEntry struct {
	Ref     string `json:"ref"`
	Oid     string `json:"oid"`
	Message string `json:"message"`
	Date    string `json:"date"`
}

type RecentRepo struct {
	Path       string `json:"path"`
	Name       string `json:"name"`
	LastOpened string `json:"lastOpened"`
}

type Settings struct {
	Theme        string       `json:"theme"`
	Language     string       `json:"language"`
	FontFamily   string       `json:"fontFamily"`
	BaseFontSize int          `json:"baseFontSize"`
	GitPath      string       `json:"gitPath"`
	ProjectsRoot string       `json:"projectsRoot"`
	AuthorName   string       `json:"authorName"`
	AuthorEmail  string       `json:"authorEmail"`
	Recent       []RecentRepo `json:"recent"`
}

type WorkspaceRepository struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	Branch  string `json:"branch"`
	Changes int    `json:"changes"`
	Kind    string `json:"kind"`
}

type Environment struct {
	GitFound   bool   `json:"gitFound"`
	GitVersion string `json:"gitVersion"`
	GoVersion  string `json:"goVersion"`
	Wails      string `json:"wails"`
}

type OperationResult struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Output  string `json:"output,omitempty"`
}
