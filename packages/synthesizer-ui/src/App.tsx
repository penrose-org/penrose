import type { Env, PenroseError, Result } from "@penrose/core";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DroppableProvided,
  DraggableProvided,
  DraggableStateSnapshot,
  DroppableStateSnapshot,
} from "react-beautiful-dnd";

import {
  compileDomain,
  compileSubstance,
  compileTrio,
  prepareState,
  prettySubstance,
  RenderStatic,
  showError,
  stepUntilConvergence,
  SubProg,
  Synthesizer,
  SynthesizerSetting,
} from "@penrose/core";

import React from "react";
import { domainProg, styProg, subProg } from "./trio";
import styled from "styled-components";

export const defaultSetting: SynthesizerSetting = {
  mutationCount: [1, 4],
  argOption: "existing",
  argReuse: "distinct",
  add: {
    type: [],
    function: [],
    constructor: [],
    predicate: ["Equal"],
  },
  delete: {
    type: [],
    function: [],
    constructor: [],
    predicate: ["IsSubset"],
  },
  edit: {
    type: [],
    function: [],
    constructor: [],
    predicate: ["IsSubset"],
  },
};

const synthesizeProgs = (
  substanceSrc: string,
  styleSrc: string,
  domainSrc: string,
  settings: SynthesizerSetting,
  numPrograms: number
) => {
  // initialize synthesizer

  const envOrError: Result<Env, PenroseError> = compileDomain(domainSrc);

  if (envOrError.isOk()) {
    const env = envOrError.value;
    let subResult;
    const subRes = compileSubstance(substanceSrc, env);
    if (subRes.isOk()) {
      subResult = subRes.value;
    } else {
      console.log(
        `Error when compiling the template Substance program: ${showError(
          subRes.error
        )}`
      );
    }
    const synth = new Synthesizer(env, settings, subResult);
    let progs = synth.generateSubstances(numPrograms);
    const template: SubProg | undefined = synth.getTemplate();

    if (template) {
      progs = [{ prog: template }, ...progs];
    }
    return progs;
  } else {
    console.log(
      `Error when compiling the domain program:\n${showError(envOrError.error)}`
    );
  }
};

const Diagram = (props: any) => {
  return (
    <div
      style={{ width: "200px", height: "200px" }}
      dangerouslySetInnerHTML={{
        __html: RenderStatic(props.state).outerHTML,
      }}
    ></div>
  );
};

const DraggableDiagram = (props: any) => {
  const { item, index } = props;
  return (
    <Draggable key={item.id} draggableId={item.id} index={index}>
      {(provided: any, snapshot: any) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={getItemStyle(
            snapshot.isDragging,
            provided.draggableProps.style
          )}
        >
          <Diagram state={item.diagramState} />
        </div>
      )}
    </Draggable>
  );
};

// a little function to help us with reordering the result
const reorder = (
  list: Iterable<unknown> | ArrayLike<unknown>,
  startIndex: number,
  endIndex: number
) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
};

const grid = 8;

const DropZone = styled.div`
  max-width: 420px;
  flex-wrap: wrap;
  display: flex;
  /*
    Needed to avoid growth in list due to lifting the first item
    Caused by display: inline-flex strangeness
  */
  align-items: start;
  /* stop the list collapsing when empty */
  /*min-width: 600px;*/
  /* stop the list collapsing when it has no items */
  min-height: 60px;
`;

const Container = styled.div`
  /* flex child */
  flex-grow: 1;
  /*
    flex parent
    needed to allow width to grow greater than body
  */
  display: inline-flex;
`;

const Wrapper = styled.div`
  max-width: 420px;
  background-color: ${({ isDraggingOver }: any) =>
    isDraggingOver ? "lightblue" : "white"};
  display: flex;
  flex-direction: column;
  padding: ${grid}px;
  user-select: none;
  transition: background-color 0.1s ease;
  margin: ${grid}px 0;
`;

const getItemStyle = (isDragging: any, draggableStyle: any) => ({
  // some basic styles to make the items look a bit nicer
  userSelect: "none",
  padding: grid * 2,
  margin: `0 0 ${grid}px 0`,

  // change background colour if dragging
  background: isDragging ? "lightgreen" : "white",

  // styles we need to apply on draggables
  ...draggableStyle,
});

const getListStyle = (isDraggingOver: any) => ({
  background: isDraggingOver ? "lightblue" : "lightgrey",
  padding: grid,
  width: 250,
});

class App extends React.Component {
  state = {
    items: [],
  };

  componentDidMount = async () => {
    this.setState({ items: await this.renderDiagrams() });
  };

  onDragEnd = (result: any) => {
    // dropped outside the list
    if (!result.destination) {
      return;
    }

    const items = reorder(
      this.state.items,
      result.source.index,
      result.destination.index
    );

    this.setState({
      items,
    });
  };

  renderDiagrams = async () => {
    const progs = synthesizeProgs(
      subProg,
      styProg,
      domainProg,
      defaultSetting,
      30
    );

    const diagramsOrErrors = progs.map(({ prog }: any) =>
      compileTrio(domainProg, prettySubstance(prog), styProg)
    );

    const diagrams = diagramsOrErrors
      .filter((s: any) => s.isOk())
      .map(async (s: any, n: number) => {
        return {
          id: `diagram-${n}`,
          diagramState: stepUntilConvergence(await prepareState(s.value)),
        };
      });
    return Promise.all(diagrams);
  };

  renderGrid = () => {
    return (
      <DragDropContext onDragEnd={this.onDragEnd}>
        <Droppable droppableId="droppable">
          {(provided: any, snapshot: any) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              style={getListStyle(snapshot.isDraggingOver)}
            >
              {this.state.items.map((item: any, index: any) => (
                <DraggableDiagram item={item} index={index} />
              ))}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    );
  };

  render() {
    return <div className="App">{this.renderGrid()}</div>;
  }
}

export default App;
