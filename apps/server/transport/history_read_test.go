package transport_test

import "testing"

func TestHistoryRequiresSessionAndValidPage(t *testing.T) {
	_, s, c := accountFixture(t)
	status, _, _ := accountRequest(t, s, c, "GET", "/history", "", origin)
	if status != 401 {
		t.Fatalf("guest: %d", status)
	}
	loginAccount(t, s, c, "Case_Admin", "a long password with spaces")
	for _, page := range []string{"-1", "abc", "1000001"} {
		status, _, _ = accountRequest(t, s, c, "GET", "/history?page="+page, "", origin)
		if status != 400 {
			t.Fatalf("invalid page %s: %d", page, status)
		}
	}
	status, value, _ := accountRequest(t, s, c, "GET", "/history", "", origin)
	if status != 200 || value["hasNext"] != false || len(value["races"].([]any)) != 0 {
		t.Fatalf("empty history: %d %v", status, value)
	}
}
