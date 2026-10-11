/**
 * Borne une promesse. Si elle ne se règle pas avant `timeoutMs`, la promesse
 * retournée rejette avec `Error("timeout")`. Le minuteur est `unref` pour ne
 * pas maintenir le processus en vie, et l'échec tardif de `work` est consommé
 * ici (pas de rejection non gérée après le délai).
 */
export function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    timer.unref();
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
