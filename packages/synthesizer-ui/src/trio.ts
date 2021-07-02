export const domainProg = `
type Set
type Point
type Map

constructor Singleton : Point p -> Set

function Intersection : Set a * Set b -> Set
function Union : Set a * Set b -> Set
function Subtraction : Set a * Set b -> Set
function CartesianProduct : Set a * Set b -> Set
function Difference : Set a * Set b -> Set
function Subset : Set a * Set b -> Set
function AddPoint : Point p * Set s1 -> Set

predicate Not : Prop p1
predicate From : Map f * Set domain * Set codomain
predicate Empty : Set s
predicate Intersecting : Set s1 * Set s2
predicate IsSubset : Set s1 * Set s2
predicate Equal : Set s1 * Set s2
predicate PointIn : Set s * Point p
predicate In : Point p * Set s
predicate Injection : Map m
predicate Surjection : Map m
predicate Bijection : Map m
predicate PairIn : Point * Point * Map

notation "A ⊂ B" ~ "IsSubset(A, B)"
notation "p ∈ A" ~ "PointIn(A, p)"
notation "p ∉ A" ~ "PointNotIn(A, p)"
notation "A ∩ B = ∅" ~ "Not(Intersecting(A, B))"
notation "f: A -> B" ~ "Map f; From(f, A, B)"
`;

export const subProg = `
Set A, B, C
IsSubset(B, A)
IsSubset(C, A)
`;

export const styProg = `
Colors {
  Colors.darkpurple = rgba(0.549,0.565,0.757, 0.2)
  Colors.black = rgba(0.0, 0.0, 0.0, 1.0)
}

Set x {
  x.shape = Circle {
      strokeWidth : 1.0
      strokeColor : Colors.black
      color: Colors.darkpurple
  }

  x.text = Text {
      string : x.label
      fontSize: "20pt"
  }

  x.labelFn = ensure contains(x.shape, x.text)
  x.minSizeFn = ensure minSize(x.shape)
  x.maxSizeFn = ensure maxSize(x.shape)
  x.layering  = x.shape below x.text
}


Set x; Set y
where IsSubset(x, y) {
  x.subsetFn0 = ensure contains(y.shape, x.shape, 20.0)
  x.subsetFn1 = ensure smallerThan(x.shape, y.shape)
  x.subsetFn2 = ensure outsideOf(y.text, x.shape)
  x.shape above y.shape
}

-- Set x; Set y; Set z
-- where IsSubset(x, y); IsSubset(y, z); {
  -- z.outsideFn = ensure outsideOf(z.text, x.shape)
  -- z.outsideFn = ensure outsideOf(z.text, y.shape)
-- }


Set x
with Set y
where Equal(x, y) {
  encourage sameCenter(x.shape, y.shape)
  encourage equal(x.shape.r, y.shape.r)

  -- override y.text.string = concat(y.label, "=", x.label)
  -- override x.text.string = 
  -- override y.labelFn = ensure contains(y.shape, y.text)
  -- override y.layering = y.shape below y.text
  -- delete x.text
  -- delete x.labelFn
  -- delete x.layering
  -- delete x.centerFn 
  -- delete x.eqFn 
}

Set x, y
where Equal(x, y); IsSubset(x, y) {
  delete x.subsetFn0
  delete x.subsetFn1
  delete x.subsetFn2
}

Set x, y {
  ensure disjoint(x.text, y.text)
}


-- This block is just for A=B<-C
-- Set x; Set y; Set z
-- where IsSubset(x, y); IsSubset(y, x); IsSubset(z, x) {
--     delete x.labelFn 
--     delete x.text 
--     delete x.outsideFn 

--     override y.text = Text {
--         string: concat(y.label, "=", x.label)
--         fontSize: "20pt"
--     } 
--     override y.labelFn = ensure contains(y.shape, y.text)
--     override y.outsideFn = ensure outsideOf(y.text, z.shape)
-- }

-- Set x; Set y; Set z
-- where IsSubset(x, y); IsSubset(y, x); IsSubset(x, z) {
--     z.containFn = ensure contains(z.shape, x.shape, 20.0)
-- }

-- Set x; Set y; Set z
-- where IsSubset(x, y); IsSubset(y, z); IsSubset(z, x) {
--     delete x.text
--     delete x.labelFn
--     delete x.layering
--     delete y.text
--     delete y.labelFn
--     delete y.layering
--     delete z.containFn
--     delete x.containFn
--     delete y.containFn

--     override z.text = Text {
--         string: concat(z.label, "=", y.label, "=", x.label)
--         fontSize: "20pt"
--     }
--     z.labelFn = ensure contains(z.shape, z.text)
--     z.centerFn = encourage sameCenter(x.shape, y.shape)
--     z.centerFn2 = encourage sameCenter(x.shape, z.shape)
--     z.centerFn2 = encourage sameCenter(y.shape, z.shape)

--     LOCAL.r = ?
--     x.shape.r = LOCAL.r
--     y.shape.r = LOCAL.r
--     z.shape.r = LOCAL.r
-- }

-- Set x; Set y; Set z
-- where IsSubset(x, z); IsSubset(y, z); IsSubset(z, x); IsSubset(z, y) {
--     delete x.text
--     delete x.labelFn
--     delete x.layering
--     delete y.text
--     delete y.labelFn
--     delete y.layering
--     delete z.containFn
--     delete x.containFn
--     delete y.containFn
--     delete z.outsideFn
--     delete x.outsideFn
--     delete y.outsideFn

--     LOCAL.r = ?

--     override z.text = Text {
--         string: concat(z.label, "=", y.label, "=", x.label)
--         fontSize: "20pt"
--     }
--     z.labelFn = ensure contains(z.shape, z.text)
--     z.centerFn = encourage sameCenter(x.shape, y.shape)
--     z.centerFn2 = encourage sameCenter(x.shape, z.shape)
--     x.shape.r = LOCAL.r
--     y.shape.r = LOCAL.r
--     z.shape.r = LOCAL.r
-- }
`;
