# Math Transformer

## Prerequisities
You must install [jscodeshift](https://www.npmjs.com/package/jscodeshift) by running `npm i jscodeshift`. If you want to run the JSCodeshift tests, run it in the `__tests__` directory. You may also want to install the corresponding types module: `npm i @types/jscodeshift`.

## Code Breakdown

Understanding the code in `toCustomAD.ts` is essential to extending it. The code is broken down into multiple sections. To easily extend the code, you should be able to understand which section to modify. You should also understand the different types of nodes that the typescript parser produces (i.e. what MemberExpression, CallExpression, etc. mean). A really helpful resource for this is the [AST Parser](https://astexplorer.net). We use the `typescript-eslint` parser.

### Section 0: Utilities

You shouldn't need to change this code. This section defines some constants and type definitions that will be used later.

### Section 1: Configuration

This section contains all the use-case-specific code. In most cases, this is the only section you should be modifying. Here is where you set what you want to translate, and how you want to translate it.

#### Subsection 1: Transformation Methods

This section contains instructions on how to transform one type of node to another node. For example, the function `BO2CE` takes in a binary expression and transforms it into a call expression. You shouldn't need to modify any of the existing code, but if you want to transform a node in a way that's not already defined, you may need to define new functions here. You can also place custom transforms here. For example, the function `squaredTransform` is custom written to transform the expression `Math.pow(x, 2)` into `squared(x)`. The dropping of an argument necessitates a custom transform, since in most cases you want to preserve all arguments when condensing a call expression. 

#### Subsection 2: Match Target Functions

A match target function extracts the information necessary to match a node to a target in Subsection 3 (Transform Maps). It's important to understand that JSCodeshift doesn't support searching by name (e.g. find all nodes that have name `pow`). Instead, we have to isolate nodes of the desired type (e.g. binary expressions), and then check if those nodes match some pattern that we want to transform. For example, the function `ME2STR` returns the `name` property of a member expression as a string. Later, we check to see if this string matches any of the names of specific member expressions we want to translate. It is important to note that all of the "to string" methods do not add spaces between syntactic units. For instance, converting the node representing the ternary expression `x ? y : z` to a string would return `x?y:z` without the spacing. This may be relevant when testing for a match.

#### Subsection 3: Transform Maps

This is the section you will probably need to modify the most. This section contains instructions on which specific AST nodes to transform, what to transform them to, and how to transform them. For instance, the `BOPS` map contains instructions on how to transform each kind of binary expression (`+, -, *, /`). Look at the `Transform` type interface to understand what needs to be included.

#### Subsection 4: Marktag

This section indicates how a user should tag a node that they want to transform. The current tag is `autodiff`, so a piece of code that has `autodiff` commented above it will be flagged for possible transforming.

#### Subsection 5: Preset Calls

This section contains an array, `translatees`, that defines which node types should be translated, and which transform map to use for each type. You shouldn't need to change this unless you want to transform a new type of AST node (the types already implemented are MemberExpression, CallExpression, BinaryExpression, UnaryExpression, ConditionalExpression (ternary), Identifier, and type labels).

### Section 2: Program Flow

This section contains everything specific to JSCodeshift and is the only section that actually issues program commands (the rest are just definitions). You shouldn't need to modify this or even understand it all, but I recommend reading through it to understand how your configurations defined in the previous section are actually applied.

## Current Functionality

Currently the following transforms will occur (you can see this in more detail in Section 1.3 of the code): 

|Original   | AD |
|-----------|----|
| x + y     | add(x, y)|
| x - y     | sub(x, y)|
| x * y     | mul(x, y)|
| x / y     | div(x, y)|
| -x        | neg(x)|
| x: number | x: VarAD|
| Math.pow(x, y) | pow(x, y)|
| Math.pow(x, 2) | squared(x)|
| x ? y : z | ifCond(x, y, z) |



NB - Due to a bug in jscodeshift, the program currently does not transform type names when they appear in an array pattern (i.e. types declared like this: `([t1, s1]: [string, any], [t2, s2]: [string, any])`). You must manually translate these names yourself (though the program will translate the same type name for you in all other contexts)


## Marking nodes to transform

To mark an AST node (basically any unit in TS, e.g. function, string, variable, type, etc.) to be transformed, comment `// autodiff` immediately above the line containing your node. It will transform that node and any subnodes. For example, to transform all binary operations inside a function, commment `// autodiff` directly above the function definition. Your nodes can be as little or as big as you'd like. If you'd like to transform all functions inside a map of functions, for instance, comment right above the dictionary's definition. If you'd only like to transform certain functions within the map, commment above each individual function. Again, your desired nodes to transform DO NOT have to be top-level function definitions.

## Testing Paths

CLI usage for jscodeshift can be found [here](https://github.com/facebook/jscodeshift).

You can run the default JSCodeshift tests by running `npm test` from the `__tests__` directory. If you're getting errors, make sure you've installed JSCodeshift in the `__tests__` directory.

Template: `jscodeshift YOURFILE.ts -t toCustomAD.ts -p -d`



### IMPORTANT NOTE - JSCODESHIFT MODIFIES THE INPUT FILE!

JSCodeshift will modify your input file in place. If this is undesirable behavior, add `-d` to perform a dry-run, and `-p` to print the output. This will take your input file and prints what the modified file would be to the console without actually modifying the file (useful, but does not have syntax highlighting). If you want to most easily compare the input and output files, I suggest making a copy of the original file, and then running JSCodeshift on the copy.

## Sample Input

    export const objDict = {
        // autodiff
        equal: (x: number, y: number) => squared(x - y),

        // autodiff
        above: ([t1, top]: [string, any], [t2, bottom]: [string, any], offset = 100) =>
            // (getY top - getY bottom - offset) ^ 2
            squared(top.y.contents - bottom.y.contents - varOf(offset))
    }

## Sample Output
    export const objDict = {
        // autodiff
        equal: (x: VarAD, y: VarAD) => squared(sub(x, y)),

        // autodiff
        above: ([t1, top]: [string, any], [t2, bottom]: [string, any], offset = 100) =>
            // (getY top - getY bottom - offset) ^ 2
            squared(sub(sub(top.y.contents, bottom.y.contents), varOf(offset)))
    }
