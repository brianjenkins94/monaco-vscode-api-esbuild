#!/bin/bash

CWD=$(pwd)

rm -rf monaco-vscode-api

if [[ "$(uname -s)" == MINGW* ]]; then
	git clone https://github.com/CodinGame/monaco-vscode-api.git
	cd monaco-vscode-api
else
	git clone --no-checkout --depth 1 --filter=tree:0 --sparse https://github.com/CodinGame/monaco-vscode-api.git
	cd monaco-vscode-api
	git sparse-checkout set --no-cone "!/*" "/demo"
	git checkout
fi

cd demo
npm uninstall dockerode

if [[ "$(uname -s)" == Darwin* ]]; then
	sed -i '' "s/file:[^\"]*/latest/g" package.json
else
	sed -i "s/file:[^\"]*/latest/g" package.json
fi

npm install --ignore-scripts vscode@npm:@codingame/monaco-vscode-api
node node_modules/vscode/monaco-treemending.js
#npm start

cd "$CWD"
