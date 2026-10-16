/**
 * Runs work whose runs may overlap so that only the latest run's result is
 * used: a run superseded by a later one, or by `cancel`, yields nothing.
 */
export class Latest {
	private generation = 0;
	private running = 0;

	get busy(): boolean {
		return this.running > 0;
	}

	async run<T>(work: () => Promise<T>): Promise<{ readonly value: T } | undefined> {
		const run = ++this.generation;
		this.running++;
		try {
			const value = await work();
			return run === this.generation ? { value } : undefined;
		} finally {
			this.running--;
		}
	}

	/** Drops the result of every run in flight. */
	cancel(): void {
		this.generation++;
	}
}
