import eslint from "@eslint/js";
import typescriptParser from "@typescript-eslint/parser";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";

const errors = {

};

const warnings = {

};

const unsure = {

};

const disabled = {

};

export default [
    // Enable baseline ruleset
    {
        "files": ["**/*.ts"],
        "ignores": ["**/node_modules/*"],
        "rules": eslint.configs.all.rules
    },

    // Disable rules that are incompatible with or better handled by TypeScript
    {
        "rules": typescriptPlugin.configs["eslint-recommended"].overrides[0].rules
    },

    // Turn on TypeScript-specific rules
    {
        "plugins": {
            "@typescript-eslint": typescriptPlugin
        },
        "languageOptions": {
            "parser": typescriptParser,
            "parserOptions": {
                "project": "./tsconfig.json"
            }
        },
        "rules": {
            ...typescriptPlugin.configs.recommended.rules,
            ...errors,
            ...warnings,
            ...unsure,
            ...disabled
        }
    }
];
