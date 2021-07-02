require("global-jsdom/register");
import {
  Registry,
  compileDomain,
  compileSubstance,
  prettySubstance,
  showError,
  showOps,
  Synthesizer,
  SubProg,
  SynthesizerSetting,
} from "@penrose/core";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import * as neodoc from "neodoc";
import { join } from "path";

const USAGE = `
Penrose Synthesizer.

Usage:
  penrose-synthesizer <domain> [options]

Options:
  --substance=SUB      A Substance program that will be included in every synthesized program     
  --style=STY          A Style program that the synthesized programs work with
  --path=PATH          Output path for the generated programs (Trailing slash not needed)
                       [default: synthesized-progs]
  --registry=REGISTRY  Path for the generated registry
                       [default: registry.json]
  --num-programs=NUM   The number of programs to generate 
                       [default: 1]
  --synth-setting=SET  A JSON file containing parameters for the synthesizer
`;

export const defaultSetting: SynthesizerSetting = {
  mutationCount: [1, 4],
  argOption: "existing",
  argReuse: "distinct",
  weights: {
    type: 0.1,
    predicate: 0.3,
    constructor: 0.0,
  },
  add: {
    // type: "*",
    type: [],
    function: [],
    constructor: [],
    // constructor: "*",
    predicate: ["Equal"],
    // predicate: [],
  },
  delete: {
    type: [],
    function: [],
    constructor: [],
    predicate: ["IsSubset"],
    // predicate: [],
  },
};

const writePrograms = (
  progs: SubProg[],
  domainSrc: string,
  prefix: string,
  styleSrc?: string,
  registryPath?: string
): void => {
  // make the directory if it doesn't exist
  const substances = {};
  const trios = [];
  const styID = "style";
  const domainID = "domain";
  const stylePath = "style.sty";
  const domainPath = "domain.dsl";
  const style = {
    name: styID,
    URI: stylePath,
  };
  const domain = {
    name: domainID,
    URI: domainPath,
  };
  if (!existsSync(prefix)) {
    mkdirSync(prefix, { recursive: true });
  }

  // Push all substance programs
  for (let i = 0; i < progs.length; i++) {
    const subID = `prog-${i}`;
    const fileName = `${subID}.sub`;
    const subPath = join(prefix, fileName);
    const metaName = `${subID}-meta.json`;
    const metaPath = join(prefix, metaName);
    const { prog, ops } = progs[i];
    writeFileSync(subPath, prettySubstance(prog));
    writeFileSync(metaPath, JSON.stringify({ ops: showOps(ops) }));
    substances[subID] = { name: subID, URI: fileName };
    trios.push({
      substance: subID,
      style: styID,
      domain: domainID,
      meta: metaName,
    });
  }
  // TODO: change name style and domain
  const registry: Registry = {
    substances,
    styles: {
      [styID]: style,
    },
    domains: {
      [domainID]: domain,
    },
    trios,
  };
  if (stylePath && registryPath) {
    writeFileSync(join(prefix, registryPath), JSON.stringify(registry));
    writeFileSync(join(prefix, domainPath), domainSrc);
    writeFileSync(join(prefix, stylePath), styleSrc);
  }
};

// Main function

(async () => {
  // Process command-line arguments
  const args = neodoc.run(USAGE, { smartOptions: true });

  // Determine the output file path
  const substancePath = args["--substance"];
  const settingPath = args["--synth-setting"];
  const outputPath = args["--path"];
  const domainPath = args["<domain>"];
  const stylePath = args["--style"];
  const numPrograms = +args["--num-programs"]; // NOTE: convert to number
  const domainSrc = readFileSync(domainPath, "utf8").toString();
  const envOrError = compileDomain(domainSrc);
  const registryPath = args["--registry"];

  // initialize synthesizer

  if (envOrError.isOk()) {
    const env = envOrError.value;
    let subResult;
    if (substancePath) {
      const substanceSrc = readFileSync(substancePath, "utf8").toString();
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
    }

    let settings;
    if (settingPath) {
      settings = JSON.parse(readFileSync(settingPath, "utf8").toString());
    } else {
      settings = defaultSetting;
    }

    const synth = new Synthesizer(env, settings, subResult);
    let progs = synth.generateSubstances(numPrograms);
    const template: SubProg | undefined = synth.getTemplate();

    if (template) {
      progs = [{ prog: template, ops: [] }, ...progs];
    }

    // write progs
    if (outputPath) {
      if (stylePath) {
        const styleSrc = readFileSync(stylePath, "utf8").toString();
        writePrograms(progs, domainSrc, outputPath, styleSrc, registryPath);
      } else {
        writePrograms(progs, domainPath, outputPath);
      }
    }

    // progs.map((prog) => console.log(prettySubstance(prog) + "\n-------"));
  } else {
    console.log(
      `Error when compiling the domain program:\n${showError(envOrError.error)}`
    );
  }
})();
