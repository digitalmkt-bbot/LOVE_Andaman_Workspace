import { useQuery } from '@tanstack/react-query';
import { LocalDate, type SourceSystem } from '@la/contracts';

/**
 * Scaffold screen. Its only job is to prove the seam works end to end:
 * the frontend imports types from @la/contracts, and reaches the API only
 * through HTTP. Replaced by the real screens in BK-11.
 */
export function App() {
  const health = useQuery({
    queryKey: ['healthz'],
    queryFn: async (): Promise<{ status: string }> => {
      const res = await fetch('/api/healthz');
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      return res.json() as Promise<{ status: string }>;
    },
  });

  // Proves the shared contract is live in the frontend: change LocalDate in
  // @la/contracts and this stops compiling.
  const today: LocalDate = LocalDate.parse(new Date().toLocaleDateString('en-CA'));
  const source: SourceSystem = 'ops';

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', lineHeight: 1.6 }}>
      <h1 style={{ marginBottom: '0.25rem' }}>LOVE Andaman · Ops</h1>
      <p style={{ color: '#667', marginTop: 0 }}>
        Platform scaffold — <code>{source}</code> · {today}
      </p>

      <h2 style={{ fontSize: '1rem', marginTop: '2rem' }}>API connection</h2>
      {health.isPending && <p>Checking…</p>}
      {health.isError && (
        <p style={{ color: '#c8384c' }}>
          Cannot reach the API. Is it running on :3001? ({String(health.error)})
        </p>
      )}
      {health.isSuccess && <p style={{ color: '#137a52' }}>API reachable — {health.data.status}</p>}
    </main>
  );
}
