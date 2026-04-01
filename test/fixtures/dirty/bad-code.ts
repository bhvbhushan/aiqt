try {
  doSomething();
} catch (e) {
  console.log(e);
}

// trivial test-like code won't trigger since not in test file path
const password = "super_secret_123";
