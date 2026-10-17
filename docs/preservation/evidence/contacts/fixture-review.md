# Independent contact fixture calculations

Reviewed `packages/contracts/race/contacts.json` at implementation commit `e1ab0b3` against world/movement rules, without deriving expected values from either engine. Cars are 50 wide × 80 long, adjacent lane centers 120 apart, normal speed 400 units/s, NOS multiplier 2 unless overridden, shifts/returns 0.15 s. Canonical times round to the nearest microsecond. All 13 literal scenarios agree within the declared tolerance.

| Scenario | Independent calculation | Expected result checked |
| --- | --- | --- |
| Boosted follower | Close 20 units at relative 400/s in .05 s; then follow at 400/s. | Progress [100,180], NOS retained, no return. Boundary-only rear contact need not emit an observation. |
| Single shifter | Side entry (120−50)/800 = .0875 s. NOS distance 70 then normal distance 45. Return starts at −50. | Progress [115,80]; x₀=−50−70(.1125/.15)=−102.5; time 87500; return/NOS off. |
| Dual shifts | Relative lateral speed 1600; entry (240−50)/1600=.11875; origins ±25. | At .2, x=±[25+95(.08125/.15)]=±76.4583333333333, progress 80 each; time 118750. |
| Dual return completion | Return ends .11875+.15=.26875. | At .3, original lanes ±120, progress 120 each, idle. |
| Existing return | Initial side touching and closing: contact at zero. Existing return remains −50→−120 over .15; new shifter returns 0→0. | At .1, [−96.6666666666667,0], progress 40 each, both returning. |
| Separating returns | Initially touching at 50; relative velocity increases separation immediately. | No contact; at .2, [−120,0], progress 80 each, idle. |
| Sideways release | Leader clears width 50 after 50/800=.0625 s. Follower travels 25 normal then 110 boosted. | Progress [135,160], x=[0,120], no return. |
| Accelerating leader | Rear gap starts 80 and grows at relative 400/s. | At .2 progress [80,240], no contact. |
| Different lanes | Lateral separation 120 exceeds width 50 throughout. | At .3 progress [240,200], no contact. |
| Equal requested speeds | Same lane, gap 80, both move 400/s. | At .5 progress [200,280], no contact, persistent lock. |
| Tick-boundary shifter | Rear closure 20/400=.05; shifting x=−80 then return to −120 by .2. | Progress [100,180], x=[−120,−120], idle/NOS off; contact 50000. |
| 20× sweep | Relative speed 7600; rear contact at 20/7600=.00263157894737 s. Remaining distance follows leader. | At .1 progress [60,140], canonical contact 2632. |
| Speed growth | Normal distance D(t)=400t+50t². Contact solves D(t)=20: t=.0496913462633177. D(.2)=82. | Progress [102,182], canonical contact 49691. |

Phase/effective-control literals also agree with these trajectories. Return snapshots preserve existing movement timers; only phase-1 cars receive a new return. HP remains 3 because player contact adds no damage. Static review checked both Go and TypeScript implementations against these calculations. Browser execution and hardware/network acceptance are outside this independent arithmetic check.
