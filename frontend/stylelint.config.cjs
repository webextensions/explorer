/* eslint-disable filenames/match-exported */
/* eslint-disable quotes */

const stylelintConfig = {
    "extends": [
        "stylelint-config-recommended",
        "stylelint-config-css-modules"
    ],

    // "ignoreFiles": [],

    "rules": {
        "color-named": "never",
        "declaration-property-value-no-unknown": true,
        "font-family-name-quotes": ["always-where-recommended"],
        "selector-type-case": ["lower"]

        // Deprecated rules
        //
        // // Various stylistic rules have been deprecated by stylelint since v15.0.0
        // // Ref: https://stylelint.io/migration-guide/to-15/#deprecated-stylistic-rules
        // // For now, commented them out to avoid warnings. In future, we may wish to bring them back if these rules
        // // are moved to a plugin or via some other tool like "prettier".
        //
        // "block-closing-brace-empty-line-before": ["never"],
        // "block-opening-brace-space-before": ["always"],
        // "color-hex-case": ["lower"],
        // "declaration-bang-space-before": ["always"],
        // "declaration-block-semicolon-space-after": ["always-single-line"],
        // "declaration-block-semicolon-space-before": ["never"],
        // "declaration-block-trailing-semicolon": ["always"],
        // "declaration-colon-space-after": ["always-single-line"],
        // "declaration-colon-space-before": ["never"],
        // "function-comma-space-after": ["always"],
        // "function-comma-space-before": ["never"],
        // "function-parentheses-space-inside": ["never"],
        // "indentation": [4],
        // "max-empty-lines": [1],
        // "no-empty-first-line": [true],
        // "no-eol-whitespace": [true],
        // "no-extra-semicolons": [true],
        // "no-missing-end-of-source-newline": [true],
        // "selector-combinator-space-after": ["always"],
        // "selector-combinator-space-before": ["always"],
        // "selector-list-comma-newline-after": ["always"],
        // "string-quotes": ["double"],
        // "value-list-comma-space-after": ["always"],
        // "value-list-comma-space-before": ["never"]
    }
};

// eslint-disable-next-line no-undef
module.exports = stylelintConfig;
