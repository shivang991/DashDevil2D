// Command setup bootstraps the single site admin without accepting secrets in argv.
package main

import (
	"bufio"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/shivang991/DashDevil2D/apps/server/accounts"
)

func main() {
	path := flag.String("database", ".local/accounts.sqlite", "persistent account database")
	username := flag.String("username", "", "admin username (3–24 letters, digits, underscores)")
	temporary := flag.Bool("temporary-password", false, "require the admin to replace the setup password on first login")
	flag.Parse()
	// Pipe from a secret file or a shell read -s prompt. Never echo the credential.
	password, err := bufio.NewReader(io.LimitReader(os.Stdin, 4098)).ReadString('\n')
	if err != nil && err != io.EOF {
		fmt.Fprintln(os.Stderr, "Unable to read password from stdin")
		os.Exit(1)
	}
	password = strings.TrimSuffix(strings.TrimSuffix(password, "\n"), "\r")
	store, err := accounts.Open(*path)
	if err == nil {
		defer store.Close()
		if *temporary {
			err = store.BootstrapTemporaryPassword(*username, password)
		} else {
			err = store.Bootstrap(*username, password)
		}
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println("Admin configured")
}
