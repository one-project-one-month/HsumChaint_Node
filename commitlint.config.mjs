export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // not allow to use uppercase letter in commit message
    'subject-case': [2, 'always', ['lower-case']],
    // not allow to use more than 100 characters in commit message
    'header-max-length': [2, 'always', 100],
    // not allow empty subject
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
  },
};
