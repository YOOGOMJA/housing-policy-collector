module.exports = {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "scope-issue-number": ({ scope }) => {
          const valid = typeof scope === "string" && /^#\d+$/.test(scope);
          return [
            valid,
            "커밋 스코프는 #이슈번호 형식이어야 합니다. 예: feat(#123): 메시지",
          ];
        },
      },
    },
  ],
  rules: {
    "scope-empty": [2, "never"],
    "scope-issue-number": [2, "always"],
  },
};
