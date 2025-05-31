#!/bin/bash

CWD=$(pwd)

rm -rf demo/ monaco-vscode-api/

git clone --no-checkout --depth 1 --filter=tree:0 --sparse https://github.com/CodinGame/monaco-vscode-api.git

cd monaco-vscode-api/

git sparse-checkout set demo/

git checkout

cd ..

cp -rf monaco-vscode-api/demo/ demo/

rm -rf monaco-vscode-api/

cd demo

if [[ "$(uname -s)" == Darwin* ]]; then
	sed -i "" "s/file:[^\"]*/latest/g" package.json
else
	sed -i "s/file:[^\"]*/latest/g" package.json
fi

npm pkg delete dependencies["@codingame/monaco-vscode-server"]
npm pkg delete dependencies["dockerode"]
npm pkg delete dependencies["express"]
npm pkg delete dependencies["ws"]

#npm pkg set overrides["@xterm/xterm"]="5.4.0-beta.20"

npm install @codingame/monaco-vscode-api@latest vscode@npm:@codingame/monaco-vscode-extension-api@latest monaco-editor@npm:@codingame/monaco-vscode-editor-api@latest

cd "$CWD"
