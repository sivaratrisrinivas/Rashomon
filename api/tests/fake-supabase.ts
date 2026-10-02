/**
 * Minimal in-memory stand-in for the subset of supabase-js the API uses.
 * It lets the tests drive the real route handlers end to end.
 */
type Row = Record<string, any>;
type Filter = (r: Row) => boolean;

let counter = 0;
const uuid = () => {
  counter++;
  const hex = counter.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
};

class Query {
  private filters: Filter[] = [];
  private op: 'select' | 'insert' | 'update' = 'select';
  private payload: Row | Row[] | null = null;
  private max = Infinity;
  private wantSingle = false;

  constructor(private db: FakeSupabase, private table: string) {}

  select(_cols?: string) { return this; }
  insert(rows: Row | Row[]) { this.op = 'insert'; this.payload = rows; return this; }
  update(patch: Row) { this.op = 'update'; this.payload = patch; return this; }
  eq(col: string, val: any) { this.filters.push((r) => r[col] === val); return this; }
  is(col: string, val: any) { this.filters.push((r) => (r[col] ?? null) === val); return this; }
  in(col: string, vals: any[]) { this.filters.push((r) => vals.includes(r[col])); return this; }
  order() { return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.wantSingle = true; return this; }

  then(resolve: (v: any) => any, reject?: (e: any) => any) {
    return Promise.resolve().then(() => this.run()).then(resolve, reject);
  }

  private run() {
    const fail = this.db.failNext[this.table];
    if (fail) {
      delete this.db.failNext[this.table];
      return { data: null, error: fail };
    }
    const rows = (this.db.tables[this.table] ??= []);
    if (this.op === 'insert') {
      const input = Array.isArray(this.payload) ? this.payload : [this.payload!];
      for (const r of input) {
        const unique = this.db.unique[this.table];
        if (unique && rows.some((x) => unique.every((c) => x[c] != null && x[c] === r[c]))) {
          return { data: null, error: { code: '23505', message: 'duplicate key' } };
        }
      }
      const created = input.map((r) => ({ id: uuid(), created_at: new Date(Date.now() + counter).toISOString(), ...r }));
      rows.push(...created);
      return this.shape(created);
    }
    const matched = rows.filter((r) => this.filters.every((f) => f(r))).slice(0, this.max);
    if (this.op === 'update') {
      matched.forEach((r) => Object.assign(r, this.payload));
    }
    return this.shape(matched);
  }

  private shape(rows: Row[]) {
    if (!this.wantSingle) return { data: rows.map((r) => ({ ...r })), error: null };
    if (rows.length === 0) return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
    return { data: { ...rows[0] }, error: null };
  }
}

export class FakeSupabase {
  tables: Record<string, Row[]> = {};
  unique: Record<string, string[]> = {};
  files: Record<string, Uint8Array> = {};
  failNext: Record<string, any> = {};
  rpcCalls: any[] = [];
  rpcMissing = false;

  from(table: string) { return new Query(this, table); }

  async rpc(name: string, args: any) {
    this.rpcCalls.push({ name, args });
    if (this.rpcMissing) return { data: null, error: { code: 'PGRST202', message: 'function not found' } };
    if (name === 'append_chat_message') {
      const s = (this.tables.chat_sessions || []).find((r) => r.id === args.p_session_id);
      if (!s) return { data: null, error: { code: 'P0002', message: 'no session' } };
      s.transcript = [...(s.transcript || []), args.p_entry];
      if (!s.participants.includes(args.p_user_id)) s.participants = [...s.participants, args.p_user_id];
      return { data: null, error: null };
    }
    return { data: null, error: { code: 'PGRST202', message: 'unknown function' } };
  }

  storage = {
    from: (_bucket: string) => ({
      download: async (path: string) => {
        const bytes = this.files[path];
        return bytes ? { data: new Blob([bytes]), error: null } : { data: null, error: { message: 'not found' } };
      },
    }),
  };
}
