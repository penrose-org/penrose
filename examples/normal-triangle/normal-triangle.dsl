type Point
type Vertex
type EdgePoint
type InputEdgePoint
type FinalEdgePoint
type FacePoint
Vertex <: Point
EdgePoint <: Point
FacePoint <: Point
InputEdgePoint <: EdgePoint
FinalEdgePoint <: EdgePoint

type LineSegment
type Edge
type Segment
type InputSegment
type FinalSegment
type Fragment
Edge <: LineSegment
Segment <: LineSegment
Fragment <: LineSegment
InputSegment <: Segment
FinalSegment <: Segment

type Triangle

predicate OnEdge: EdgePoint * Edge
predicate Intersect: Segment * Segment

constructor MakeTriangle: Vertex v1 * Vertex v2 * Vertex v3 -> Triangle
constructor MakeEdge: Vertex v1 * Vertex v2 -> Edge
constructor MakeSegment: Point v1 * Point v2 -> Segment
constructor MakeFragment: Point v1 * Point v2 -> Fragment
constructor Intersection: Segment s1 * Segment s2 -> FacePoint

notation "{ a, b, c }" ~ "MakeTriangle( a, b, c )"
notation "{ a, b }" ~ "MakeEdge( a, b )"
notation "[ a, b ]" ~ "MakeSegment( a, b )"
notation "< a, b >" ~ "MakeFragment( a, b )"

