package main

import (
	"archive/tar"
	"bufio"
	"bytes"
	"compress/gzip"
	"crypto/rand"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

//go:embed payload.tar.gz
var payload []byte

func extract(target string) error {
	compressed, err := gzip.NewReader(bytes.NewReader(payload))
	if err != nil {
		return err
	}
	defer compressed.Close()

	archive := tar.NewReader(compressed)
	for {
		entry, err := archive.Next()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}

		name := filepath.Clean(filepath.FromSlash(entry.Name))
		if name == "." || filepath.IsAbs(name) || name == ".." || strings.HasPrefix(name, ".."+string(os.PathSeparator)) {
			return fmt.Errorf("invalid archive path: %q", entry.Name)
		}
		path := filepath.Join(target, name)
		switch entry.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(path, 0755); err != nil {
				return err
			}
		case tar.TypeReg, tar.TypeRegA:
			if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
				return err
			}
			file, err := os.OpenFile(path, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0644)
			if err != nil {
				return err
			}
			_, copyErr := io.Copy(file, archive)
			closeErr := file.Close()
			if copyErr != nil {
				return copyErr
			}
			if closeErr != nil {
				return closeErr
			}
		default:
			return fmt.Errorf("unsupported archive entry: %q", entry.Name)
		}
	}
}

func runtimeDir() (string, error) {
	cache, err := os.UserCacheDir()
	if err != nil {
		return "", err
	}
	cache = filepath.Join(cache, "CenacApi")
	if err := os.MkdirAll(cache, 0755); err != nil {
		return "", err
	}
	checksum := sha256.Sum256(payload)
	name := "runtime-" + hex.EncodeToString(checksum[:8])
	target := filepath.Join(cache, name)
	ready := filepath.Join(target, ".ready")
	if _, err := os.Stat(ready); err == nil {
		return target, nil
	}

	temporary, err := os.MkdirTemp(cache, "install-")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(temporary)
	if err := extract(temporary); err != nil {
		return "", err
	}
	if err := os.WriteFile(filepath.Join(temporary, ".ready"), []byte("ok"), 0644); err != nil {
		return "", err
	}
	if err := os.Rename(temporary, target); err != nil {
		if _, readyErr := os.Stat(ready); readyErr != nil {
			return "", err
		}
	}
	return target, nil
}

func run() error {
	runtime, err := runtimeDir()
	if err != nil {
		return err
	}
	nodePath := filepath.Join(runtime, "node.exe")
	executable, err := os.Executable()
	if err != nil {
		return err
	}
	workingDir := filepath.Dir(executable)
	if os.Getenv("JWT_SECRET") == "" {
		path := filepath.Join(workingDir, ".env")
		if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
			secret := make([]byte, 32)
			if _, err := rand.Read(secret); err != nil {
				return err
			}
			file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
			if err != nil && !errors.Is(err, os.ErrExist) {
				return err
			}
			if err == nil {
				_, writeErr := fmt.Fprintf(file, "JWT_SECRET=%s\n", hex.EncodeToString(secret))
				closeErr := file.Close()
				if writeErr != nil {
					return writeErr
				}
				if closeErr != nil {
					return closeErr
				}
			}
		} else if err != nil {
			return err
		}
	}
	command := exec.Command(nodePath, filepath.Join(runtime, "src", "app.js"))
	command.Dir = workingDir
	command.Env = os.Environ()
	command.Stdin = os.Stdin
	logPath := filepath.Join(workingDir, "cenac-api.log")
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer logFile.Close()
	fmt.Fprintf(logFile, "\n--- %s ---\n", time.Now().Format(time.RFC3339))
	version, versionErr := exec.Command(nodePath, "--version").Output()
	if versionErr != nil {
		return fmt.Errorf("could not run %s: %w", nodePath, versionErr)
	}
	fmt.Fprintf(logFile, "Node: %s (%s)\n", nodePath, strings.TrimSpace(string(version)))
	command.Stdout = io.MultiWriter(os.Stdout, logFile)
	command.Stderr = io.MultiWriter(os.Stderr, logFile)
	if err := command.Run(); err != nil {
		fmt.Fprintf(logFile, "Server exited: %v\n", err)
		return fmt.Errorf("server exited; see %s: %w", logPath, err)
	}
	return fmt.Errorf("server stopped; see %s", logPath)
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		fmt.Fprintln(os.Stderr, "Press Enter to close this window.")
		bufio.NewReader(os.Stdin).ReadString('\n')
		os.Exit(1)
	}
}
