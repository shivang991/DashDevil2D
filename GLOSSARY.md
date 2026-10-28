# DashDevil

A driving game with a single-player mode and two multiplayer modes.

## Language

**Long Drive**:
The existing single-player mode, retaining its gameplay and presentation while removing touch controls.
_Avoid_: Solo Trip

**Drag Race**:
A two-player race decided by reaching the finish line or the opponent running out of HP, with ties possible.

**Road Rage**:
A two-player survival round decided by HP at the time limit or the opponent running out of HP, with ties possible.

**Finish crossing**:
The instant the front edge of a Drag Race car first reaches the finish line, regardless of lane or an ongoing lane shift or return.

**Round time**:
Elapsed gameplay time from the multiplayer round's start at zero; the preceding countdown is excluded.

**Road Rage deadline**:
The round-time limit at which Road Rage ends, after resolving gameplay events occurring exactly at that instant.

**Round outcome**:
The final multiplayer result: one player wins and the other loses, both tie, or the round is abandoned without a winner. Events after the round ends cannot change it.

**Predicted round state**:
A client's provisional view of multiplayer movement, contacts, HP, and road-object interactions. Predicted death or finish indications do not finalize the round outcome.

**Rendered car position**:
The position at which a multiplayer car appears on screen, which may temporarily differ from its predicted position while a correction settles. It does not determine contacts, pickups, or finish crossings.

**Authoritative round state**:
The server-confirmed multiplayer state against which client predictions are checked. Only its confirmed round outcome ends the round.

**Road Rage input history**:
The shared history of both players' accepted fresh steering and NOS presses throughout a round, ordered by authoritative application time; steering at a road edge counts. Releases, keyboard auto-repeat, automatic shifts from held steering, and ignored presses do not count.

**Road Rage collision responsibility**:
An eligible player collision selects every involved player except the player who supplied the latest event in the Road Rage input history to lose HP.

**Player contact episode**:
Uninterrupted contact between the cars, allowing at most one player-contact damage decision. Separation followed by a fresh impact starts another episode, including during a lane return.

**Room code**:
A shareable four-digit code used to join a private two-player multiplayer room.

**Room**:
A private multiplayer gathering for up to two players that can persist across rounds. A disconnected participant's seat remains reserved for a limited recovery period.

**Host**:
The room participant who selects the multiplayer mode and starts rounds after both players are ready. The creator initially holds this role; it transfers to the remaining participant when the host leaves or loses their reserved seat.

**Lobby**:
The room's gathering state in which players choose a mode and mark readiness for the next round.

**Ready**:
A player's explicit agreement to play the room's selected mode. A mode change clears both players' readiness.

**Local name**:
A player's immutable display name, retained across visits when local storage is available. Different players may share the same name.

**Reconnect grace**:
The limited period during which a disconnected participant can reclaim their reserved room seat in any room phase. An active round continues during this period.

**Forfeit**:
A multiplayer loss caused by explicitly leaving an active round or exhausting reconnect grace while the opponent remains connected.

**Abandoned round**:
A multiplayer round ended without a winner because neither participant remains connected when reconnect grace expires, a participant explicitly leaves while the opponent is disconnected, or excessive server simulation lag prevents continued play.

**Rematch**:
A fresh round in the same room, requiring renewed readiness and resetting gameplay state.

**HP**:
A player's remaining health; reaching zero ends that player's participation in an active multiplayer round according to the mode's outcome rules.

**Long Drive acceleration**:
The unlimited, held speed increase in Long Drive, ending when the acceleration input is released or replaced by steering input.

**Long Drive invincibility**:
The temporary protection after taking damage in Long Drive, during which further obstacle hits cause no health loss while coins remain collectible.

**Road Rage invincibility**:
Temporary protection after taking damage in Road Rage, preventing further HP loss from obstacles and player collisions for a configurable duration. Protection does not prevent a required lane return or transfer damage to the opponent.

**NOS**:
The unlimited, held speed boost in Drag Race and Road Rage, with no fuel, cooldown, or duration limit; the primary mechanic for overtaking. Release, steering, or a lane return cancels it, and activation requires a fresh boost press outside a lane return.

**Multiplayer driving input**:
A player's combined steering and NOS holds from keyboard and touch in Drag Race and Road Rage. A control remains held until its last input source releases; interrupted driving requires fresh input to resume.

**Road progress**:
A multiplayer car's distance along the shared road, advancing independently of the other car's progress.

**Lane**:
One of three driving paths across the road, named left, middle, and right in the direction of travel.

**Lane shift**:
A car's movement across the road toward an adjacent lane, completing despite input changes unless contact with the other player causes a lane return.

**Lane return**:
A sliding movement back to the departure lane after a shifting car hits the other player, during which NOS is disabled.

**Tailgating**:
Following another car in the same lane when contact prevents the trailing car from passing or changing lanes; no lane return or player-contact damage occurs.

**Track**:
The ordered placement of road objects across three lanes along the road, finite in Drag Race and extended during play in Long Drive and Road Rage.

**Road scenery**:
The visual appearance of the road surface and roadside surroundings. Scenery does not affect lanes, road-object placement, or collisions.

**Road slice**:
A position along the road with one cell for each lane; each cell is empty or contains a single obstacle, coin, or heart.

**Pickup**:
A collectible road object. Multiplayer pickups are shared and consumed once; exact simultaneous contact by both players consumes the pickup without benefiting either.

**Heart**:
A pickup that restores one HP up to the collecting player's maximum HP, consumed even when that player already has full HP. Multiplayer hearts are shared; Long Drive excludes them by default.

**Obstacle**:
A road object that can damage a car on contact. Each multiplayer obstacle's interaction is spent separately for each player, including contact while invincible; Long Drive obstacles are consumed on contact.

**Coin**:
A pickup worth ten points, with no effect on multiplayer victory. Long Drive includes coins by default; multiplayer modes exclude them by default.
