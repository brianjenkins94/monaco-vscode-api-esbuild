#!/bin/bash

CWD=$(pwd)

git clone --no-checkout --depth 1 --filter=tree:0 --sparse https://github.com/CodinGame/monaco-vscode-api.git monaco
cd monaco
git sparse-checkout set --no-cone "!/*" "/demo"
git checkout

cd "$CWD"
