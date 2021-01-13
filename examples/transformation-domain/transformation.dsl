-- Types
type Scalar
type VectorSpace
type Vector
type LinearMap

-- Operators
function neg: Vector v -> Vector
function scale: Scalar c * Vector v -> Vector cv
function addV: Vector * Vector -> Vector
function addS: Scalar s1 * Scalar s2 -> Scalar
function norm: Vector v -> Scalar
function innerProduct: Vector * Vector -> Scalar
function determinant: Vector * Vector -> Scalar
function apply: LinearMap f * Vector -> Vector

-- Predicates
predicate In: Vector * VectorSpace V
predicate From: LinearMap V * VectorSpace domain * VectorSpace codomain
predicate Not: Prop p1
predicate Orthogonal: Vector v1 * Vector v2
predicate Unit: Vector v

-- Syntactic sugar
notation "det(v1, v2)" ~ "determinant(v1, v2)"
notation "LinearMap f : U → V" ~ "LinearMap f; From(f, U, V)"
notation "v1 + v2" ~ "addV(v1, v2)"
notation "-v1" ~ "neg(v1)"
notation "Vector a ∈ U" ~ "Vector a; In(a, U)"
notation "|y1|" ~ "norm(y1)"
notation "<v1,v2>" ~ "innerProduct(v1, v2)"
notation "s * v1" ~ "scale(s, v1)"
notation "Scalar c := " ~ "Scalar c; c := "
notation "f(v)" ~ "apply(f, v)"

-- Examples for prelude, just for reproducing (Should be removed)

--value T : VectorSpace
-- value T1 : VectorSpace
