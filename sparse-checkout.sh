#!/bin/bash

CWD=$(pwd)

git clone --no-checkout --depth 1 --filter=tree:0 --sparse https://github.com/CodinGame/monaco-vscode-api.git monaco
cd monaco
git sparse-checkout set --no-cone "!/*" "/demo"
git checkout

cd demo
npm install --ignore-scripts
npm install vscode@npm:@codingame/monaco-vscode-api -f
node node_modules/vscode/monaco-treemending.js
#npm start

cd "$CWD"
