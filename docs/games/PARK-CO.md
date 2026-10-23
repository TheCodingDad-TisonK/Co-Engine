# Park Co

A small theme park. Guests arrive from the car park, buy a ticket at a window, pass a turnstile and pick a ride: the coaster, or any of the seven rides that stand either side of the midway. You work the window and the coaster: sell the tickets, open the gates, watch the queue file in, pull the restraints down, dispatch, and pull the lever when you would rather the ride ran itself. Written 2026-10-16 as game four on Co Engine, in its own repo, Park Co, from the same day; grown into a whole park 2026-10-17.

## The pitch

You run a small park with one good coaster and seven flat rides. The gate opens at nine and the guests come in from the car park. They queue at a ticket window, and the window is yours to work: stand at the counter, press E, and the guest at the front of the line pays and walks to a turnstile. Past the turnstile they pick the ride with the shortest line. For the coaster the ride is yours too: open the gates, and the front of the queue walks in one seat at a time; pull the restraints down, dispatch. Get the order wrong and the desk refuses you. Pull the lever and the ride runs itself, and you can stand on the platform and watch the train go round. Every other ride runs itself the moment it stands.

## The loop

1. **Arrive.** A guest walks in from the car park and joins the shorter ticket line.
2. **Sell.** At the window, serve the guest at the front of the line. The ticket is sold, the money lands, the guest walks to a turnstile. The screen on the counter sells too.
3. **In.** The turnstile spins as it is passed and the guest picks the shortest line: the coaster, or any open ride.
4. **Load.** For the coaster, open the gates and the queue walks in, front to back, one seat at a time. Pull the restraints down.
5. **Dispatch.** Send the train. It runs the circuit and comes home; the guests get off and either ride again, buy a snack or go home.
6. **Earn.** Tickets, rides and snacks earn xp. The ladder opens the snack stand, a clerk, an operator and the park lights.

Trouble, one kind at a time: a ride that stops on the lift, rain that closes the coaster, a queue that grows past its lane, a train that will not dispatch until it is serviced.

## The ladder

| Level | The park | What opens |
|---|---|---|
| 1 | **The gate, the coaster and the seven rides.** Two ticket windows, four turnstiles, the midway, the station, the operator's room. | The ticket price, the ride controls, every ride from the first day |
| 2 | **The snack stand.** A stand on the midway with a screen and a price. | Fries, the snack price |
| 3 | **The clerk.** The window serves itself. | A ticket clerk, wages |
| 4 | **The operator.** The coaster runs itself whether the lever is over or not. | A ride operator, wages |
| 5 | **The lights.** The park stays open into the evening. | Park lights, longer hours |

## Systems

- **The coaster as a curve.** One closed `CatmullRomCurve3` through fourteen control points, 170 m. The station straight is the first segment; the station `u` is found by sampling the curve for the point nearest the platform, never guessed. The train is placed by `u`, three cars spaced by a fixed gap in metres converted to `u`.
- **The ride state machine.** `idle → loading → ready → dispatch → running → arrive → unload`, plus `fault`. Each control is legal only in the right states, and an illegal press is refused with a toast and a count. The speed comes from the track height: 4 m/s on the lift, otherwise `sqrt(2g(15.5 - y))` clamped 4 to 26, so the train is fast at the bottom and slow at the top without a hand-written speed profile.
- **AUTO.** A lever on the desk. With it over, a timer walks the same state machine the player would: open the gates, wait for the seats to fill or a timeout, restraints down, dispatch. The lever is the saved truth; the ride follows it.
- **The coaster queue.** A fenced lane beside the platform, one guest to a slot. A guest joins at the back (`pkQueueJoin`) and shuffles up as the line drains (`pkQueueReslot`). When the gates open, `pkRideLoad` invites the front of the line in one seat at a time: the guest walks from the lane to their car and is seated only when they arrive (`board → seated`), so the crowd visibly files in rather than blinking onto the train. The restraints and the dispatch wait while anyone is still walking to a seat.
- **Guests as a state machine on a walk record.** `toBooth → walkBooth → boothQueue → toTurn → walkTurn → walkQueue → queue → board → seated → off → toSnack/leave → gone`, plus the attraction states. The engine's `walkAlong` and `route` do the walking; the game does the deciding. Guests are pooled and reused, and a pooled human has its ground blob taken off before `disposeTree` because the blob material is a shared singleton.
- **The attraction system.** Every flat ride is the same shape: a queue, a set of seats parented to whatever moves, and four states `idle → boarding → running → unloading`. A guest picks the shortest open line, is seated when the ride boards, and is let off at the exit when it is done. The coaster keeps its own state machine; the seven rides all share this one.
- **The dressing.** Each ride gets its own world: a paved apron, bunting along three sides, a gateway over the queue with the ride's name, planters and lamps, and a signature piece (a band organ, a giant teapot, a rim of bulbs, neon strips, a gantry, a waterfall, dead trees and cold fog). It is all parented to one group per plot, hidden and unbaked while the plot is closed, so opening a ride flips the group and bakes again.
- **The crowd.** The engine's `CO.npcs` makes the wanderers and the staff from data: characters, spawners on a clock, and a list of steps. They do not queue or buy; the queuing guests are a different machine.
- **Seats.** Twelve coaster seats, four per car, filled in a fixed order (the platform side first). A seated guest is parented to the car group and posed with the engine's `sit` mode; the seat's local `y` is the guest's `baseY`, so the hips land on the seat rather than through it.
- **The desk and the screen.** Four buttons and a lever as hit boxes with prompts, and a touch screen on the north wall that mirrors them. Both routes call the same functions, so the desk and the screen can never disagree.
- **The platform.** The platform sits south of the track so the queue and the guests reach it without crossing the rails. A ramp carries the player and the guests up the 0.6 m step; the engine's `collides` blocks a step up of more than 0.5 m, so the ramp is the only way up and the north edge is a drop.
- **The day.** A game minute a second, nine to ten at night. The gate closes at ten, the guests stop arriving, and midnight pays the wages and starts the next day.
- **Weather.** Rain and storm close the coaster.

## What the engine gives, what is new

Engine as of v0.13.1: the world kit, props and build mode, doors, people, screens, the vehicle meshes and lane traffic, weather, saves, the shell, the dev console, the editor.

New for this game (and engine candidates afterwards): a coaster track built from a curve with the station found by sampling, a train placed along `u` with cars spaced in metres, a ride state machine with legal-order refusals, a lever that hands a machine over to a timer, a queued boarding flow where guests walk to their seats, an attraction system shared by seven flat rides, a per-ride dressing system, and seats as parented guests posed with the `sit` mode.

Prop packs it would ship and share: `park` (benches, bins, flower beds, lamps, trees, signs), `ride` (track, ties, legs, cars, restraints, gates, turnstiles), `booth` (ticket windows, counters, screens).

## Art direction

The same generated look: bevelled boxes, canvas textures, the house slate and amber for signs, a green park wrapped in a forest, and eight rides each in its own colours. The park sounds: the turnstile click, the restraint lock, the dispatch bell, the train on the lift, the flume's splash.

## Scope

Comparable to Garage Co at 0.3: five levels, eight rides, two windows, a snack stand, two roles. The coaster curve, the ride state machine and the queued boarding flow are the parts with no precedent in the other games.

## Open questions for Tyson

- One coaster and seven flat rides stand from day one; should any ride stay behind a level, or is "everything open, the services are what you earn" the right shape?
- Should a guest refuse to pay, or is every guest a sale? A refusal needs a mood and a reason.
- The flat rides run themselves on a fixed cycle; do they deserve their own operators, or is that scope for later?
