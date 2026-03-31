---
description: Testing Guidelines for Agents
---

# Testing Guidelines

When writing or modifying test cases, you MUST follow these guidelines:

1. **Verify All Tests:** Always run the entire test suite (`npm test -- --run` or equivalent) to guarantee that all tests, both new and existing, pass successfully before concluding your task. Do not assume that fixing one test won't break another.
2. **Update Test Coverage:** Always generate an updated test coverage report after successfully running tests (e.g., using `npx vitest run --coverage` or your framework's coverage command) so that the user is continuously informed of the coverage metrics.
3. **Clean Up Temporary Files:** If you redirect test output to temporary files for inspection (e.g., `test_output.txt`), or create any other temporary analysis scripts/files, you MUST delete them after testing is completed. Do not leave temporary artifacts in the project directory.
4. **Use Temporary Directories:** If you must create scratch scripts or one-off log files, generate them in the `tmp` folder or `/tmp/` directory if possible. If a temporary script, test file, or generated coverage report is left in the project root or source directory, you must remove it once you've finished debugging or reporting.
5. **Mandatory Tests for Code Changes:** After every code change (new features, bug fixes, refactors), test cases MUST be added or updated to cover the modified code paths. No code change is considered complete without corresponding test updates.
6. **Coverage Must Be Maintained:** After every code change, verify that test coverage has not regressed. Run coverage and confirm that the coverage percentages for affected modules remain at or above the established thresholds. If a change introduces new uncovered lines, add tests to cover them before completing the task.
7. **Firebase Mocking**: All Firebase operations in unit tests MUST be mocked using `vi.mock` or a global mock system (e.g., in `tests/setup.js`). Never allow actual network requests to Firebase Storage or Firestore during test execution.
8. **No Production Side Effects**: Tests MUST NOT modify any actual Firebase files or cloud resources. All administrative operations (sync, backup, media management) must be safely intercepted by mocks.
