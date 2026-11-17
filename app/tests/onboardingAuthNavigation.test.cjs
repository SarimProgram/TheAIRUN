const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../app/(tabs)/Onboarding.tsx'), 'utf8');
const ast = ts.createSourceFile('Onboarding.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(predicate, node = ast) {
  if (predicate(node)) return node;
  return ts.forEachChild(node, child => find(predicate, child));
}
function evaluate(node, scope, sourceAst = ast) {
  const js = ts.transpileModule(`const callback = ${node.getText(sourceAst)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText;
  return new Function(...Object.keys(scope), `${js}\nreturn callback;`)(...Object.values(scope));
}

async function afterAuth(phase, destination = null, newAccount = false) {
  const visited = [];
  const scope = {
    planData: {}, pendingPartnerAcceptInviteIdRef: { current: null },
    postAuthDestinationRef: { current: destination },
    shouldPersistCheckpointRef: { current: false }, pendingServerFlushRef: { current: false },
    setAuthIntent() {}, transitionToPhase: value => visited.push(value),
    loadOnboardingCheckpoint: async () => phase === null ? null : ({ completed: false, currentPhase: phase }),
    hasExistingPlan: () => { throw new Error('New registrations must not wait for a plan lookup'); },
    resolveRestoredPhase: value => value,
  };
  const declaration = find(node => ts.isVariableDeclaration(node) && node.name.getText(ast) === 'continueAfterAuth');
  await evaluate(declaration.initializer.arguments[0], scope)(undefined, newAccount);
  return visited;
}

test('successful authentication advances past saved login and registration screens', async () => {
  for (const phase of [0, 1, 22, 24]) assert.deepEqual(await afterAuth(phase), [3]);
});

test('session application completes even when invite linking and analytics never resolve', async () => {
  const text = fs.readFileSync(path.join(__dirname, '../src/auth/authContext.tsx'), 'utf8');
  const authAst = ts.createSourceFile('auth.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = find(node => ts.isVariableDeclaration(node) && node.name.getText(authAst) === 'applyAuthResponse', authAst);
  const never = () => new Promise(() => {});
  const saved = [];
  const apply = evaluate(declaration.initializer.arguments[0], {
    saveTokens: async () => {}, claimStoredGuestPartnerInvite: never,
    setAccessToken: token => saved.push(token), setUser: user => saved.push(user.id),
    setAnalyticsUserId: never, setAnalyticsUserProperties: never,
  }, authAst);
  let timer;
  try {
    await Promise.race([
      apply({ accessToken: 'test-token', user: { id: 'test-user' } }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Session blocked by background work')), 500); }),
    ]);
  } finally { clearTimeout(timer); }
  assert.deepEqual(saved, ['test-token', 'test-user']);
});

test('retrying continuation after account creation never registers the same account twice', async () => {
  const text = fs.readFileSync(path.join(__dirname, '../components/onboarding/Phase0ManualAuth.tsx'), 'utf8');
  const formAst = ts.createSourceFile('form.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = find(node => ts.isVariableDeclaration(node) && node.name.getText(formAst) === 'handleSubmit', formAst);
  let registrations = 0;
  let continuations = 0;
  const submit = evaluate(declaration.initializer, {
    name: 'Test', email: 'test@example.com', password: 'password', confirmPassword: 'password',
    submittingRef: { current: false }, registeredRef: { current: false }, setLoading() {},
    onRegister: async () => { registrations++; },
    onSuccess: async () => { if (++continuations === 1) throw new Error('Navigation failed'); },
    Alert: { alert() {} },
  }, formAst);
  await submit();
  await submit();
  assert.equal(registrations, 1);
  assert.equal(continuations, 2);
});

test('successful authentication resumes onboarding progress or its requested destination', async () => {
  assert.deepEqual(await afterAuth(7), [7]);
  assert.deepEqual(await afterAuth(22, 11), [11]);
  assert.deepEqual(await afterAuth(24, 9), [9]);
});

test('a new registration without a checkpoint advances without a plan request', async () => {
  assert.deepEqual(await afterAuth(null, null, true), [3]);
});

test('switching auth forms preserves the onboarding destination and partner intent', () => {
  for (const [component, prop, phase] of [
    ['Phase0ManualLogin', 'onRegisterPress', 22],
    ['Phase0ManualAuth', 'onLoginPress', 24],
  ]) {
    const element = find(node => ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === component);
    const attribute = element.attributes.properties.find(item => item.name?.getText(ast) === prop);
    const visited = [];
    evaluate(attribute.initializer.expression, { transitionToPhase: value => visited.push(value) })();
    assert.deepEqual(visited, [phase]);
  }
});
