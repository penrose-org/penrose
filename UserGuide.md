In `penrose/penrose-web/src`, run `npm start`
In `penrose/examples/` run `runpenrose my.sub my.sty my.domain`

Shape library:
https://github.com/penrose/penrose/wiki/Shape-and-function-library

Tensor flow math operations:
https://js.tensorflow.org/api/latest/#Operations

# Adding new constraints

First, add the function definitions here:

* `penrose/react-renderer/src/contrib/Constraints.ts`
* `src/Penrose/Functions.hs`

Next, rebuild Penrose by typing `stack build` in `penrose/`

Note: constraints are treated as inequality constraints f(x) ≥ 0; to get equality, you must have two inequality constraints.  More explicitly, if we define a function f(x), then the solver will add the penalty

   φ(x) = { f(x)^2, if f(x) > 0,
                 0, if f(x) ≤ 0
          }

Note that the definition in `Constraints.ts` is the one really used for optimization; the definition in `Functions.hs` is used to sample initial values.

# Error message

Error reporting is really not great yet; probably best to ignore the actual error messages (which may point you in the wrong direction) and just read the line it points to.

# Adding new functions

In Computations.ts, copy-paste something like cosine, and modify for whatever function you want

In Functions.hs, find the compDict list, and make a corresponding function
Also in Functions.hs, copy-paste the definition of cosine, and modify it to match the new function (name of course should match what you added to the compDict list).

Finally, Rebuild the Penrose backend

# Setup

Clone Penrose repo https://github.com/penrose/penrose.git
  -- Do we want a "slim" repo for deployment?
-- Do we want a Build.md that redirects to the repo wiki?
Install Haskell stack via Homebrew: brew install haskell-stack
-- can we do a one-click build/installer/CMake file?
-- would be good to insert description of how to build headless version
-- tell people [how] to install node + npm <--- not standard for most people
   brew install node
-- there are two frontends:
   1. react-renderer -- installed (but not built) by default
   2. use.penrose -- must install
? which frontend does "the frontend" refer to in the wiki?
   cd into penrose/react-renderer
   npm install
   npm run build-lib
   npm link
   cd into penrose-ide/ide-frontend
   npm link react-renderer
   cd into penrose
   stack build
   To run react renderer:
      npm-start in penrose/react-renderer
   Then run Penrose with .dsl/.sub/.sty triple
   To clean up/rebuild Penrose from scratch
      stack clean
      stack install
   Should be installed somewhere like ~/.local/bin/penrose
Penrose IDE (use.penrose): [ can we put more of this in a build script? ]
  To install:
     From the same directory containing `penrose`, run
        git clone https://github.com/penrose/penrose-ide.git
        cd penrose-ide/ide-frontend
        npm install
        cd into penrose-ide/substance-languageservice
        npm install
  To run:
     cd penrose-ide/ide-frontend
     npm start
   Stuff that shows up is determined by penrose/penrose/tree/master/examples/*Library.json
  NOTE: Penrose IDE didn't connect to the server

# To rebuild the frontend

npm install
npm run build-lib
npm start

# Adding shapes

Some related notes:
- https://github.com/penrose/penrose/wiki/React-Rendering-Frontend

In front end: files for each shape
Each file takes JSON for shape
Read properties from there, direct to an SVG element

Compiler produces JSON
Files translate JSON to SVG

# To try (running faster)

True, we usually run penrose with npm run start which has heavy debugging tools attached (edited) 
11:35
And it indeed can be a lot faster in production build (for "normal apps", not sure about our case) (edited) 
11:37
To try it, just do npm run build and find the folder it's building to (build/ I think) and you can run npx serve in there
:+1:
1


katherine  11:49 AM
Just tried it but it's serving the build folder, rather than our app. Looks like to make that work, we need an index.html:
npm run build creates a build directory with a production build of your app. Set up your favorite HTTP server so that a visitor to your site is served index.html, and requests to static paths like /static/js/main.<hash>.js are served with the contents of the /static/js/main.<hash>.js file.
https://create-react-app.dev/docs/deployment/

nimoni:paperclip:  12:29 PM
serve -s build -l 4000 worked for me
12:29
Running in react-renderer

nimoni:paperclip:  12:35 PM
Hard to tell if it’s much faster visually. Lmk if you have trouble setting it up @katherine

katherine  1:07 PM
Is there an index.html that I should be landing on?
1:08
I installed serve, ran serve -s build -l 4000 in react-renderer, same result as before
1:08
(Just shows "index of build/")

nimoni:paperclip:  1:13 PM
There should be one. Delete build and rerun npm run build and see what happens.
1:13
FYI I’m on master

