import * as vscode from 'vscode'

async function isRenameable(document: vscode.TextDocument, position: vscode.Position): Promise<boolean> {
	try {
		await vscode.commands.executeCommand(
			'vscode.executePrepareRename',
			document.uri,
			position
		)
		return true
	} catch {
		return false
	}
}

async function getRenameableSymbols(document: vscode.TextDocument): Promise<{ name: string; range: vscode.Range }[]> {
	const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', document.uri);

	const results: { name: string; range: vscode.Range }[] = []

	if (!symbols) return results

	async function traverse(symbols: vscode.DocumentSymbol[]) {
		for (const symbol of symbols) {
			const canRename = await isRenameable(document, symbol.selectionRange.start)
			if (canRename) {
				results.push({ name: symbol.name, range: symbol.selectionRange })
			}
			if (symbol.children.length > 0) {
				await traverse(symbol.children)
			}
		}
	}

	await traverse(symbols)
	return results
}

export async function activate(context: vscode.ExtensionContext) {
	console.log("activated")

	const command = vscode.commands.registerCommand('renameableSymbols.list', async function() {
		console.log("command")

		const editor = vscode.window.activeTextEditor
		if (!editor) {
			vscode.window.showInformationMessage('No active editor.')
			return
		}

		const document = editor.document
		const symbols = await getRenameableSymbols(document)

		if (symbols.length === 0) {
			vscode.window.showInformationMessage('No renameable symbols found.')
			return
		}

		const items = symbols.map((s) => ({
			label: s.name,
			description: `Line ${s.range.start.line + 1}`,
			range: s.range
		}))

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: 'Select a symbol to rename'
		})

		if (selected) {
			editor.selection = new vscode.Selection(selected.range.start, selected.range.end)
			editor.revealRange(selected.range, vscode.TextEditorRevealType.InCenter)

			const newName = await vscode.window.showInputBox({
				prompt: `Rename '${selected.label}' to:`
			})

			if (newName) {
				await vscode.commands.executeCommand(
					'editor.action.rename',
					selected.range.start
				)
			}
		}
	})

	context.subscriptions.push(command)
}

export function deactivate() { }
