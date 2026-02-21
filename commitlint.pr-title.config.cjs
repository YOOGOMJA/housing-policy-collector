module.exports = {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "scope-governance": ({ scope }) => {
          if (typeof scope !== "string" || !scope.trim()) {
            return [false, "PR 제목 스코프는 비워둘 수 없습니다."];
          }

          const isIssueScope = /^#\d+$/.test(scope);
          const allowedScopes = new Set([
            "docs",
            "workflow",
            "policy",
            "ops",
            "parser",
            "collector",
            "notifier",
            "storage",
            "ci",
            "deps",
          ]);

          if (isIssueScope || allowedScopes.has(scope)) {
            return [
              true,
              "PR 제목 스코프는 #이슈번호 또는 허용된 도메인 스코프여야 합니다.",
            ];
          }

          return [
            false,
            "PR 제목 스코프는 #이슈번호 또는 허용된 도메인 스코프(docs/workflow/policy/ops/parser/collector/notifier/storage/ci/deps)여야 합니다.",
          ];
        },
      },
    },
  ],
  rules: {
    "scope-empty": [2, "never"],
    "scope-governance": [2, "always"],
  },
};
