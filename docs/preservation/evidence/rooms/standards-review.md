Hard standards violations: None found.

Possible smells (judgment calls):

- Possible Duplicated Code — `apps/server/transport/server.go:309–317` and `apps/server/transport/pair.go:347–355` repeat the same random-seed construction: `var seed [4]byte`, `rand.Read(seed[:])`, `binary.BigEndian.Uint32(seed[:])`, and zero replacement. A small shared `newRoundSeed() (uint32, error)` would keep room creation and subsequent round starts consistent. This is a maintainability suggestion, not a correctness blocker.

Additional correctness observation: `apps/client/src/transport/PairedConnection.ts:149` clears `state.pending` on every connected RoomState update, including unrelated focus/state broadcasts, even while `pendingCommands` still contains a mutating command awaiting RoomReply. This can prematurely re-enable mutating controls and allow overlapping commands or stale-revision rejections. Clear admission/recovery pending here only, and retain command pending until its matching RoomReply.
