# Garden Co.

A first-person garden centre. You grow the stock, stock the benches, serve the customers, and the polytunnel grows into a centre with a café and fields. The candidate that reuses the most from both games at once, written 2026-10-08.

## The pitch

You take over a polytunnel on a plot by the road. Seedlings go in trays, trays go on benches, customers wander in on a Saturday and buy what looks good. Spring is bedding plants, summer is baskets and tomatoes, autumn is bulbs and shrubs, December is trees and wreaths. Frost kills what you left outside, a wet week empties the car park, and a sunny bank holiday fills it. The supplier's lorry brings compost and pots on pallets; your van takes orders into town. By the end you run a centre with a café, a nursery field and a delivery round.

## The loop

1. **Grow.** Seed trays in the propagator, prick out, pot on, water, feed, pinch out. Grow Co's plant model with the strain table swapped for a plant catalogue: bedding, perennials, shrubs, veg, houseplants, trees.
2. **Stock.** Carry trays to the benches and shelves (the carry and hotbar kit); price them with the gun; the sign kit prints the shelf edge.
3. **Serve.** Customers come in by the car park, browse the benches, pick things up, queue at the till (Grow Co's customer and queue system). Advice sells: a customer with a question buys more when answered.
4. **Receive.** The supplier lorry docks at the back (Depot Co's trucks, pallets and forklift): compost, pots, seed, young plants, Christmas trees in season. Put away in the store.
5. **Deliver.** The van takes orders into town (Grow Co's van rounds), later a trailer for trees and turf.
6. **Season and weather.** Demand follows the calendar; weather follows the season; stock has a shelf life and a hardiness.

Trouble: frost warnings (bring the tender stock in or fleece it), pests on a bench, a power cut in the propagator, the inspector for plant passports, a delivery that arrives wrong.

## The ladder

| Levels | The building | What opens |
|---|---|---|
| 1 to 4 | **The polytunnel.** One tunnel, a bench, a table with a cash tin, a hose, a hand-written sign on the road. | The propagator, the first bench row, the first hire |
| 5 to 9 | **The greenhouse and the shop.** A glasshouse, a small shop with the till and the PC, a covered sales area, a yard with the first pallets. | The supplier account, the forklift, bedding and perennial lines, the water timer |
| 10 to 14 | **The garden centre.** The big sales hall, outdoor benches under shade cloth, the car park, the trolleys, the van. | Shrubs and trees, the delivery round, the second greenhouse, the potting machine |
| 15 to 19 | **The café and the yard.** The café off the hall, the aquatics and pet corner, the stone and timber yard with a loader. | Events (the plant fair), the café staff, bulk goods |
| 20 to 25 | **The nursery fields.** Field beds behind the centre, the tractor, a tree line, the Christmas barn. | Wholesale contracts, the tree lot, the full calendar |

## Systems

- **Plants as stock.** A plant has a stage, a size, a health, a shelf life and a season of demand. Grow Co's growth and care loop drives it; the catalogue is data.
- **Benches and shelves.** Slots that hold trays and pots (the Depot Co slot model), with a price label each, inside under glass or outside under cloth.
- **Customers.** Grow Co's queue and till with a browse phase: a customer has a want (a colour, a kind, a price), walks the benches, picks up, asks, and buys or leaves. Baskets and trolleys.
- **Calendar.** A year of weeks; each week a demand profile and a weather profile; the day report shows what sold.
- **Hardiness and frost.** Overnight temperature from the weather kit; tender stock outside dies below its line; fleece and the propagator protect.
- **Supplies.** Pallets of compost, pots, trays, seed, feed. Trucks, slots and the forklift from Depot Co.
- **Staff.** Grower, cashier, driver, café hand, yard hand. The rig, the router, the roles.
- **The café.** Grow Co's coffee machine and seating comfort kit, a menu board, a queue of its own.
- **Deliveries and the round.** Grow Co's van rounds and tablet, with the town kit outside.

## What the engine gives, what is new

Engine as of M2: the world kit, props and build mode, doors, people, screens, the vehicle meshes and the drivable van, the yard and the town, weather and seasons, saves, the shell, the dev console, the editor.

New for this game (and engine candidates afterwards): a calendar with weekly demand and weather profiles, a browse phase for customers (walk, pick, ask), hardiness and overnight temperature, shade cloth and glass as light modifiers, a field bed system, the tractor as a slow vehicle with a trailer.

Prop packs it would ship and share: `greenhouse` (glass walls, vents, benches, the propagator, the potting machine), `nursery` (trays, pots, bags, the hose, fleece), `cafe` (counter, tables, menu board), `yard-bulk` (bays of gravel and bark, the loader).

## Art direction

Glass and aluminium, green on green, warm timber for the shop, a wide pale sky. The plants are Grow Co's generated foliage with new tops: flowers as coloured cards, shrubs as lumpy spheres, trees from the world kit. Rain on glass, fleece as a white cloth sheet, frost as a tint on the morning yard.

## Scope

Larger than Depot Co in content (a catalogue of eighty plants, a year of weeks) but smaller in machinery. On the engine it is the strongest proof of the packs, because almost every system has a parent in one of the two games. The first playable polytunnel (levels 1 to 4) is weeks of work; the full calendar is the long tail.

## Open questions for Tyson

- A real year of 52 weeks, or four seasons of seven days as Depot Co has? The calendar sets the whole pace.
- Does the customer browse phase need a basket model, or is a customer one purchase at a time at the start?
- The café: its own queue and staff from level 15, or a counter you serve yourself first?
