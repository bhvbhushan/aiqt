try {
  doSomething();
} catch (error) {
  logger.error('Operation failed', { error });
  throw new ServiceError('Operation failed', error);
}
