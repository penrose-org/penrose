import { sortStmts, typeOf } from "analysis/SubstanceAnalysis";
import {
  compileDomain,
  compileSubstance,
  prettySubstance,
  showError,
} from "index";
import { cloneDeep } from "lodash";
import { createChoice } from "pandemonium/choice";
import { applyDiff, rdiffResult } from "recursive-diff";
import seedrandom from "seedrandom";
import {
  DeclTypes,
  SynthesizedSubstance,
  Synthesizer,
  SynthesizerSetting,
} from "synthesis/Synthesizer";
import { SubProg, SubRes } from "types/substance";
import {
  applyStmtDiffs,
  DiffSet,
  diffSubProgs,
  diffSubStmts,
  showDiffset,
  showStmtDiff,
  StmtDiff,
  subProgDiffs,
  swapDiffID,
} from "./Search";

const SEED = "testSearch";

const all: DeclTypes = {
  type: "*",
  function: "*",
  constructor: "*",
  predicate: "*",
};
const none: DeclTypes = {
  type: [],
  function: [],
  constructor: [],
  predicate: [],
};

const settings: SynthesizerSetting = {
  mutationCount: [1, 4],
  argOption: "existing",
  argReuse: "distinct",
  weights: {
    type: 0.1,
    predicate: 0.3,
    constructor: 0.0,
  },
  add: all,
  delete: none,
  // edit: all,
  edit: {
    type: [],
    function: [],
    constructor: [],
    predicate: ["IsSubset"],
  },
};

const RNG = seedrandom("seed5");
const choice: <T>(array: Array<T>) => T = createChoice(RNG);

const domainSrc = `
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
`;

const substanceSrc = `
Set A, B, C
IsSubset(B, A)
IsSubset(C, A)
`;

const getSubRes = (domainSrc: string, substanceSrc: string): SubRes => {
  const envOrError = compileDomain(domainSrc);
  if (envOrError.isOk()) {
    const env = envOrError.value;
    const subRes = compileSubstance(substanceSrc, env);
    if (subRes.isOk()) {
      const subResult = subRes.value;
      return subResult;
    } else {
      throw new Error(
        `Error when compiling the Substance program: ${showError(subRes.error)}`
      );
    }
  } else {
    throw new Error(
      `Error when compiling the Domain program:\n${showError(envOrError.error)}`
    );
  }
};

const initSynth = (
  domainSrc: string,
  substanceSrc: string,
  settings: SynthesizerSetting
): Synthesizer => {
  const subRes = getSubRes(domainSrc, substanceSrc);
  const env = subRes[1];
  return new Synthesizer(env, settings, subRes, SEED);
};

describe("Synthesizer tests", () => {
  // test("next config", () => {
  //   const synth: Synthesizer = initSynth(domainSrc, substanceSrc, settings);
  //   const progs: SynthesizedSubstance[] = synth.generateSubstances(10);
  //   synthesizeConfig(progs);
  //   // COMBAK: complete test once `synthesizeConfig` is working
  // });

  test("Compute AST diff based on tree sets", () => {
    const original = `
    Set A, B, C, D, E
    D := Union(A, B)
    IsSubset(B, A)
    IsSubset(C, A)
    Equal(E, E)
    `;
    const edited = `
    Set A, B, C, D, E
    IsSubset(B, A)
    IsSubset(D, A)
    E := Union(A, B)
    `;
    const res1: SubRes = getSubRes(domainSrc, original);
    const ast1: SubProg = res1[0].ast;
    const ast2: SubProg = getSubRes(domainSrc, edited)[0].ast;
    const diffs: DiffSet = subProgDiffs(ast1, ast2);
    console.log(diffs);
    console.log(showDiffset(diffs));
  });

  test("applying AST diff with id swap", () => {
    const prog1 = `
    Set A, B, C, D, E, F, Z
    IsSubset(B, A)
    IsSubset(C, A)
    -- D := Union(A, B)
    Z := Union(A, B) -- This will mess up the ordering
    `;
    const prog2 = `
    Set A, B, C, D, E, F, Z
    IsSubset(B, A)
    IsSubset(D, A)
    F := Union(A, B)
    `;
    const res1: SubRes = getSubRes(domainSrc, prog1);
    const ast1: SubProg = res1[0].ast;
    const ast2: SubProg = getSubRes(domainSrc, prog2)[0].ast;
    const diffs: StmtDiff[] = diffSubStmts(ast1, ast2);
    expect(diffs).toHaveLength(2);
    expect(diffs.map(showStmtDiff)).toEqual([
      "Changed IsSubset(C, A) (Identifier): C (args,0,value) -> D",
      "Changed Z := Union(A, B) (Identifier): Z (variable,value) -> F",
    ]);
    const env = res1[1];
    const ids = env.varIDs;
    const swappedDiffs: StmtDiff[] = diffs.map((d: StmtDiff) => {
      if (d.diffType === "Identifier") {
        const matchingIDs = ids.filter(
          (id) => typeOf(id.value, env) === typeOf(d.diff.val, env)
        );
        const choices = matchingIDs.filter(
          (id) => ![d.diff.val, d.originalValue].includes(id.value)
        );
        return swapDiffID(d, choice(choices));
      } else return d;
    });

    console.log(`Swapped diffs:\n${swappedDiffs.map(showStmtDiff).join("\n")}`);
    const res = applyStmtDiffs(ast1, swappedDiffs);
    console.log(prettySubstance(res));
    // TODO: add assertions
  });

  test("applying AST diff regardless of stmt ordering", () => {
    const prog1 = `
    Set A, B, C
    IsSubset(A,B)
    IsSubset(C, A)
    `;
    const prog2 = `
    Set A, B, C
    IsSubset(C,A)
    IsSubset(B, A)
    `;
    const ast1: SubProg = getSubRes(domainSrc, prog1)[0].ast;
    const ast2: SubProg = getSubRes(domainSrc, prog2)[0].ast;
    const diffs: StmtDiff[] = diffSubStmts(ast1, ast2);
    // the ASTs have normalized ordering, so there should be only two diffs
    expect(diffs).toHaveLength(2);
    console.log(diffs.map(showStmtDiff).join("\n"));

    // apply the stmt diffs, grouped by target statements
    const ast2From1 = applyStmtDiffs(ast1, diffs);
    // the result should be semantically equivalent to the second program
    expect(prettySubstance(sortStmts(ast2From1))).toEqual(
      prettySubstance(sortStmts(ast2))
    );
    // ...but different in the source because the diff is applied to the 2nd statement
    expect(prettySubstance(ast2From1)).not.toEqual(prettySubstance(ast2));
  });
  test("applying exact AST diff", () => {
    const prog1 = `
    Set A, B, C
    IsSubset(C, A)
    IsSubset(A,B)
    `;
    const prog2 = `
    Set A, B, C
    IsSubset(C,A)
    IsSubset(B, A)
    `;
    const ast1: SubProg = getSubRes(domainSrc, prog1)[0].ast;
    const ast2: SubProg = getSubRes(domainSrc, prog2)[0].ast;
    const diffs: rdiffResult[] = diffSubProgs(ast1, ast2);
    // because we filtered out all the noisy diffs, the exact formatting should not matter much
    expect(diffs).toHaveLength(2);
    // NOTE: `applyDiff` actually mutates the object :(
    const ast2From1 = applyDiff(cloneDeep(ast1), diffs);
    // the exact objects won't be equal, because the ASTs don't have the same positional info
    expect(ast2From1).not.toEqual(ast2);
    // ...but the ASTs are actually the same, which can be shown by checking the trees
    expect(prettySubstance(ast2From1)).toEqual(prettySubstance(ast2));
    expect(prettySubstance(ast2From1)).not.toEqual(prettySubstance(ast1));
  });
});
