// Prints status only; never prints credentials or tokens.
const root = process.env.DIRECT_LINE_DOMAIN || 'https://directline.botframework.com';
try {
  const response = await fetch(`${root}/v3/directline/tokens/generate`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.DIRECT_LINE_SECRET}` }, signal: AbortSignal.timeout(15000) });
  console.log(`Token generation HTTP ${response.status}`);
  if (!response.ok) process.exitCode = 1;
  else {
    const data = await response.json();
    const start = await fetch(`${root}/v3/directline/conversations`, { method: 'POST', headers: { Authorization: `Bearer ${data.token}` }, signal: AbortSignal.timeout(15000) });
    console.log(`Conversation start HTTP ${start.status}`);
    if (!start.ok) process.exitCode = 1;
  }
} catch { console.log('Connection verification failed'); process.exitCode = 1; }
