try {
  const response = await fetch(`http://127.0.0.1:${process.env.PORT || 80}/api/health`, {
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok || (await response.json()).status !== 'ready') process.exit(1);
} catch {
  process.exit(1);
}
