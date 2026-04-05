export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 160],
    "subject-empty": [2, "never"],
    "type-empty": [2, "never"],
  },
};
