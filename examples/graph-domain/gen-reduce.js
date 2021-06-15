const NUM_PRE_VARS = 6000;
const NUM_VARS = 600;

let progStr = "";
let xs = "";

for (let i = 0; i < NUM_PRE_VARS; i++) {
  progStr += `const x${i} = ${i};\n`;
}

for (let i = NUM_PRE_VARS; i < NUM_PRE_VARS + NUM_VARS; i++) {
  progStr += `const x${i} = ${i};\n`;
  xs += `x${i}, `;
}

progStr += `const res = [${xs}].reduce((x, y) => x + y);\n`;

progStr += `console.log("res", res);`;

console.log(progStr);
