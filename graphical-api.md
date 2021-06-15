- Go through the algo for `contains`
    - Original pseudocode:
    ```
    -- Top-level function on two generic objects
    contains A B =
        let d = contains (bbox A) (bbox B)
        if d != 0 then d
        else
            contains (levelSet A) (levelSet B)

    contains (BBox a) (BBox b) =
        if ! ( a.L > b. L .... )
            return dist( a.center, b.center) - Epsilon
        else 0

    contains (LevelSet a) (LevelSet b) =
        -- Assuming we have globally uniform grid resolution

        for x in width that they overlap
           for y in height that they overlap
               if ( b.grid[ x,y ] <= 0 )
                   if ( a.grid[ x,y ] > 0 )
                   -- return farthest “worst” pixel distance function   
                   -- average or handle points          
               return 0
    ```
- Alignment
    - Idea 1: recompute the overlapped region with pixel resolution and forget about alignment (most likely we need the entire initial SDF)
        - Potential performance cost
        - Force users to input initial SDF in pixel resolution?
        - Overall, maybe run into problems with up/downsampling and interpolation
- Recomputation of levelset and BVH - solving slow runtime
    - Idea 1: compute finer levelset on demand -> if only BVH needed to finish the spatial query, compute levelSet at a coarser level. Once the BVH test is not deterministic, then compute finer levelset
- Coordinate systems and transformations among them
    - the grid coordinates (levelset)
    - the math coordinates (default in the system)
    - the screen coordinates (frontend)
    - Transformations
        - math <-> screen: translation (CANVAS dimensions)
        - grid <-> math: translation and scaling (resolution of LevelSet, __top-left corner of the grid in math coords__)
- Other objectives
    - `intersects`
    - `overlap`
