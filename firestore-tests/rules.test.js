// Firestore security rules tests. Run with: npm run test:rules (starts the Firestore emulator).
const fs = require('fs');
const path = require('path');
const { assertFails, assertSucceeds, initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { deleteDoc, doc, getDoc, getDocs, collection, setDoc, setLogLevel, updateDoc } = require('firebase/firestore');

setLogLevel('error'); // denied writes are expected; don't log each one

let env;

const item = (overrides = {}) => ({
  expr: '(3+4)×12−5',
  result: '79',
  angle: 'deg',
  pinned: false,
  createdAt: 1759600000000,
  updatedAt: 1759600000000,
  ...overrides,
});

const db = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const itemRef = (firestore, uid, id = 'calc-1') => doc(firestore, 'users', uid, 'history', id);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-calq',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  // seed alice's item, bypassing the rules
  await env.withSecurityRulesDisabled((ctx) => setDoc(itemRef(ctx.firestore(), 'alice'), item()));
});

describe('owner', () => {
  test('can create, read, list, update and delete their own items', async () => {
    const alice = db('alice');
    await assertSucceeds(setDoc(itemRef(alice, 'alice', 'calc-2'), item()));
    await assertSucceeds(getDoc(itemRef(alice, 'alice')));
    await assertSucceeds(getDocs(collection(alice, 'users', 'alice', 'history')));
    await assertSucceeds(updateDoc(itemRef(alice, 'alice'), { pinned: true, updatedAt: 1759600009999 }));
    await assertSucceeds(deleteDoc(itemRef(alice, 'alice')));
  });

  test('can write the same item twice (merge on sign-in is idempotent)', async () => {
    const alice = db('alice');
    await assertSucceeds(setDoc(itemRef(alice, 'alice'), item()));
  });
});

describe('other users and guests', () => {
  test('another user cannot read, list, write or delete', async () => {
    const bob = db('bob');
    await assertFails(getDoc(itemRef(bob, 'alice')));
    await assertFails(getDocs(collection(bob, 'users', 'alice', 'history')));
    await assertFails(setDoc(itemRef(bob, 'alice', 'calc-9'), item()));
    await assertFails(updateDoc(itemRef(bob, 'alice'), { pinned: true }));
    await assertFails(deleteDoc(itemRef(bob, 'alice')));
  });

  test('signed-out users cannot read or write', async () => {
    const guest = db(null);
    await assertFails(getDoc(itemRef(guest, 'alice')));
    await assertFails(setDoc(itemRef(guest, 'alice', 'calc-9'), item()));
  });

  test('nothing outside users/{uid}/history is allowed', async () => {
    const alice = db('alice');
    await assertFails(setDoc(doc(alice, 'users', 'alice'), { name: 'Alice' }));
    await assertFails(setDoc(doc(alice, 'other', 'x'), { a: 1 }));
  });
});

describe('field validation', () => {
  const rejects = (data) => assertFails(setDoc(itemRef(db('alice'), 'alice', 'calc-new'), data));

  test('extra fields', () => rejects(item({ extra: true })));
  test('missing fields', () => {
    const { pinned, ...missing } = item();
    return rejects(missing);
  });
  test('expression over 200 characters', () => rejects(item({ expr: '1'.repeat(201) })));
  test('empty expression', () => rejects(item({ expr: '' })));
  test('result over 200 characters', () => rejects(item({ result: '9'.repeat(201) })));
  test('unknown angle unit', () => rejects(item({ angle: 'grad' })));
  test('pinned not a boolean', () => rejects(item({ pinned: 'yes' })));
  test('timestamps not integers', () => rejects(item({ createdAt: 'today' })));

  test('200-character expression is allowed', () =>
    assertSucceeds(setDoc(itemRef(db('alice'), 'alice', 'calc-new'), item({ expr: '1'.repeat(200) }))));

  test('update cannot change createdAt', () =>
    assertFails(updateDoc(itemRef(db('alice'), 'alice'), { createdAt: 1, updatedAt: 1759600009999 })));
});
