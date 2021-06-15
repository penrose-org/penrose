GOAL: Implement an MVP layout hack and see if it improves speed/scalability, as well as what changes are necessary in the system.

- PROBLEM: Set up an all-pairs problem: a labeling problem with 30 labels (of different dims?) that all need to be disjoint. Labels are of fixed sizes, AABB.
  - Check that `disjoint` on rects works
  - Maybe implement the area version from Keenan
  - BASELINE: Benchmark how long that one takes, and how many steps

- IMPROVEMENT: Use an all-pairs acceleration method that prunes out spatially unrelated functions.
  - Compile each objective and constraint individually using `evalFns` and `genFns`
  
  Is this still going to be applicable if `contains` is in the mix, and has to be?

New TODO
- `NewIter`: cache the obj/constr functions
  - move/re-export caching from `index.ts`

- on each new step:
  - make bboxes of each shape
  - pass in the bboxes before call to `minimize`, into `pruneOptProblem`
  - `pruneOptProblem`: grid -> bbox[] -> [objfn[], constrfn[]][] -> [objfn[], constrfn[]][]
    - TODO - grid datatype
    - only works on disjoint?
    - TODO - only check radial distance for now, then make a grid later
  - new objective and its gradient are produced programmatically and passed to `minimize`
    - genNewEnergyAndGradient: TODO ???
  - compare benchmark time

- test:
  - factor out `accelerate all pairs` as a flag
  - you should get the same resulting diagrams (solutions are the same)
  - can an external test be written?
  
  ===
  
  - Construct a grid data structure (i.e. calculate its size) based on the label sizes
    - Desired: If the shapes overlap, then they must be neighbors.
    - Probably works to make the cellSize the max of the label dimensons
    - cellSize = 100 if labels are 100x100? Maybe a little smaller? TODO
  - On each optimization step, compose the energy/gradient based on the functions that are active in each cell.
    - Make a 2D array of grid pixels, containing each object in it.
      - indices (i, j) => (i*cellSize, j*cellSize) (top left of cell)
      - coordinates (x, y) => (floor((x-h/2)/cellSize), floor((-y-h/2)/cellSize)) ... something like that
        ...do something involving (0,0) at top-left vs center
    - PREV: For each cell-with-neighborhood, for each shape x in the central cell, add terms f(x,y) for each term y in a neighboring cell
      - TODO: Doesn't the original algorithm double-count, if you iterate over *every* cell?
      - TODO: Could you instead iterate over every object, and then find the cell that it's in, and then look at its neighbors, and remove a constraint/objective from the list if it's clearly active (is applied exactly to x and y) (so the function is not double counted)? This seems intuitively simpler/better.
  - IMPROVEMENT: Benchmark how long this takes, and how many steps.

TRADEOFFS:
+ The runtime is now O(n) in the number of items.
- Dynamically composing objectives/constraints may result in some slowdown (maybe not, though).
- See other limitations below.

LIMITATIONS:
- Requires knowing which constraints/objectives are "spatially related" (i.e. for which ones the grid pruning is even effective). Right now we just use `disjoint` which has to be spatial.
- Requires that objects are fixed-size.
